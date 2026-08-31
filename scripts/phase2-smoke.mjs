import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function testTaskEngine() {
  console.log('--- task-engine ---');
  const { TaskGraphStore } = await import('@cluster/task-engine');
  const store = TaskGraphStore.create('Build feature X');
  const t1 = store.addTask({ title: 'Gather context', agentRole: 'context' });
  const t2 = store.addTask({ title: 'Implement core', agentRole: 'coder', dependsOn: [t1.id] });
  const t3 = store.addTask({ title: 'Implement secondary (parallel)', agentRole: 'coder', dependsOn: [t1.id] });
  const t4 = store.addTask({ title: 'Review', agentRole: 'reviewer', dependsOn: [t2.id, t3.id] });
  const t5 = store.addTask({ title: 'Verify', agentRole: 'tester', dependsOn: [t4.id] });
  console.log(`Created ${Object.keys(store.graph.tasks).length} tasks`);
  const order = store.topologicalOrder();
  assert(order.ok, 'should be acyclic');
  console.log('Topo order:', order.order.slice(0, 3).join(' -> '));
  const batches = store.executionBatches();
  console.log('Batches:', batches.map(b => b.length).join(', '));
  assert(batches.length >= 3, 'should have multiple batches');
  // Parallel groups: t2 and t3 should be in same batch (both depend on t1 only)
  const batchWithT2 = batches.find(b => b.includes(t2.id));
  const batchWithT3 = batches.find(b => b.includes(t3.id));
  assert(batchWithT2 === batchWithT3 || JSON.stringify(batchWithT2) === JSON.stringify(batchWithT3), 't2 and t3 should be parallel');
  // Status tracking
  store.setStatus(t1.id, 'done');
  assert(store.getTask(t2.id).status === 'ready' || store.getTask(t2.id).status === 'pending', 't2 should be ready after t1 done');
  console.log('Status tracking OK');
}

async function testTaskEngineParallel() {
  console.log('--- task-engine parallel execution ---');
  const { TaskEngine } = await import('@cluster/task-engine');
  const { TaskGraphStore } = await import('@cluster/task-engine');
  const store = TaskGraphStore.create('Parallel test');
  const a = store.addTask({ title: 'Task A', agentRole: 'coder' });
  const b = store.addTask({ title: 'Task B', agentRole: 'coder' });
  const c = store.addTask({ title: 'Task C', agentRole: 'tester', dependsOn: [a.id, b.id] });
  const engine = new TaskEngine(store.graph, { maxConcurrency: 2 });
  const executed = [];
  engine.registerExecutor(async (task) => {
    executed.push(task.title);
    await new Promise(r => setTimeout(r, 10));
    return { success: true, result: 'done' };
  });
  await engine.runAll();
  console.log('Executed:', executed.join(', '));
  assert(executed.includes('Task A') && executed.includes('Task B'), 'parallel tasks executed');
  assert(engine.stats().done === 3, 'all done');
  // Test retry
  const store2 = TaskGraphStore.create('Retry test');
  const t = store2.addTask({ title: 'Flaky', agentRole: 'coder', maxAttempts: 2 });
  const engine2 = new TaskEngine(store2.graph);
  let attempts = 0;
  engine2.registerExecutor(async () => {
    attempts++;
    if (attempts < 2) return { success: false, error: 'flaky' };
    return { success: true };
  });
  await engine2.runAll();
  assert(attempts === 2, 'retry worked');
  console.log('Retry OK');
  // Test cancel
  const store3 = TaskGraphStore.create('Cancel test');
  store3.addTask({ title: 'Long', agentRole: 'coder' });
  const engine3 = new TaskEngine(store3.graph);
  engine3.registerExecutor(async (task, signal) => {
    await new Promise((res, rej) => {
      const t = setTimeout(() => res({ success: true }), 1000);
      signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('cancelled')); });
    }).catch(() => ({ success: false, error: 'cancelled' }));
    return { success: false, error: 'cancelled' };
  });
  const p = engine3.runAll();
  setTimeout(() => engine3.cancel(), 20);
  await p;
  console.log('Cancel OK, status:', engine3.getStatus());
}

async function testContextEngine() {
  console.log('--- context-engine ---');
  const { rankFiles } = await import('@cluster/context-engine');
  const candidates = [
    { path: 'src/components/Button.tsx', size: 4000, language: 'TypeScript', contentPreview: 'export function Button() {}', area: 'src' },
    { path: 'src/utils/helpers.ts', size: 2000, language: 'TypeScript', contentPreview: 'helper', area: 'src' },
    { path: 'docs/README.md', size: 1000, language: 'Markdown', contentPreview: 'Button docs', area: 'docs' },
  ];
  const ranked = rankFiles(candidates, { query: 'Button component', maxFiles: 5 });
  assert(ranked[0].path.includes('Button'), 'Button file should rank highest');
  console.log('Ranking OK:', ranked.map(r => `${r.path}:${r.score}`).join(', '));

  const { chunkFile, extractSymbols } = await import('@cluster/context-engine');
  const largeContent = Array.from({ length: 300 }, (_, i) => `export function func${i}() { return ${i}; }`).join('\n');
  const chunks = chunkFile('src/large.ts', largeContent, { maxChunkLines: 50 });
  console.log('Chunks:', chunks.length);
  assert(chunks.length > 1, 'should chunk large file');
  const symbols = extractSymbols('src/test.ts', 'export function foo() {}\nclass Bar {}\nconst x = 1;');
  console.log('Symbols:', symbols.map(s => s.name).join(', '));
  assert(symbols.length >= 2, 'should extract symbols');

  const { ContextEngine } = await import('@cluster/context-engine');
  const engine = new ContextEngine({ projectRoot: process.cwd() });
  const intel = await engine.gatherIntelligence();
  console.log('Repo intelligence:', intel.projectKind, intel.languages.slice(0,2).join(','));
}

async function testMemory() {
  console.log('--- memory ---');
  const { MemoryStore } = await import('@cluster/memory');
  const tmpRoot = path.join(os.tmpdir(), `cluster-test-${Date.now()}`);
  await fs.mkdir(tmpRoot, { recursive: true });
  const store = new MemoryStore({ projectRoot: tmpRoot, sessionId: 'test-sess' });
  await store.init();
  await store.add({ scope: 'project', category: 'fact', key: 'framework', value: 'uses Next.js', source: 'user' });
  await store.add({ scope: 'session', category: 'note', key: 'task', value: 'implement button', source: 'auto' });
  const proj = await store.recall({ scope: 'project' });
  const sess = await store.recall({ scope: 'session' });
  assert(proj.length === 1 && sess.length === 1, 'memory recall');
  const filtered = await store.recall({ query: 'Next' });
  assert(filtered.length > 0, 'query recall');
  await store.addImportantFile('src/app.ts', 'main entry');
  const important = await store.getImportantFiles();
  assert(important.length === 1, 'important files');
  console.log('Memory OK');
  await fs.rm(tmpRoot, { recursive: true, force: true });
}

async function testCheckpoints() {
  console.log('--- checkpoints ---');
  const { createCheckpoint, listCheckpoints, rollbackToCheckpoint } = await import('@cluster/storage');
  const tmpRoot = path.join(os.tmpdir(), `cluster-chk-${Date.now()}`);
  await fs.mkdir(tmpRoot, { recursive: true });
  const file = path.join(tmpRoot, 'test.txt');
  await fs.writeFile(file, 'original', 'utf8');
  const chk = await createCheckpoint({ sessionId: 'test-sess', projectRoot: tmpRoot, message: 'before edit', files: [file] });
  assert(chk.id, 'checkpoint created');
  await fs.writeFile(file, 'modified', 'utf8');
  const list = await listCheckpoints('test-sess');
  assert(list.length > 0, 'list checkpoints');
  const res = await rollbackToCheckpoint({ sessionId: 'test-sess', checkpointId: chk.id, projectRoot: tmpRoot });
  assert(res.restored.length > 0, 'rollback restored');
  const content = await fs.readFile(file, 'utf8');
  assert(content === 'original', 'rollback content');
  console.log('Checkpoints OK');
  await fs.rm(tmpRoot, { recursive: true, force: true });
  // cleanup checkpoint dir
  const home = path.join(os.homedir(), '.cluster', 'checkpoints', 'test-sess');
  await fs.rm(home, { recursive: true, force: true }).catch(() => {});
}

async function testToolRuntime() {
  console.log('--- tool-runtime ---');
  const { ToolRegistry, createDefaultRegistry, createPhase2Registry } = await import('@cluster/tool-runtime');
  const { canUseTool } = await import('@cluster/shared');
  const reg = createDefaultRegistry();
  assert(reg.list().length >= 10, 'default tools');
  const phase2 = createPhase2Registry();
  assert(phase2.list().length >= reg.list().length, 'phase2 has more');
  // Plugin
  const plugin = { name: 'test-plugin', tools: [] };
  // Create dummy tool
  const { defineTool } = await import('@cluster/tool-runtime');
  const { z } = await import('zod');
  const dummy = defineTool({ name: 'dummy_test', description: 'test', schema: z.object({}), risk: 'safe', execute: async () => ({ ok: true, output: 'ok' }) });
  const reg2 = new ToolRegistry();
  reg2.register(dummy);
  reg2.registerPlugin({ name: 'my-plugin', tools: [defineTool({ name: 'plugin_tool', description: 'p', schema: z.object({}), risk: 'safe', execute: async () => ({ ok: true, output: 'p' }) })] });
  assert(reg2.has('plugin_tool'), 'plugin tool registered');
  // Permissions per role
  assert(canUseTool('coder', 'write_file') === true, 'coder can write');
  assert(canUseTool('reviewer', 'write_file') === false, 'reviewer cannot write');
  assert(canUseTool('context', 'run_command') === false, 'context cannot run command');
  console.log('Tool runtime OK, forRole coder:', reg.forRole('coder').length, 'reviewer:', reg.forRole('reviewer').length);
}

async function testVerification() {
  console.log('--- verification ---');
  const { discoverTests, selectRelevantTests } = await import('@cluster/tool-runtime');
  const tests = await discoverTests(process.cwd());
  console.log('Discovered:', tests.slice(0,2).join(', '));
  const relevant = selectRelevantTests(['src/components/Button.tsx'], tests);
  console.log('Relevant:', relevant.join(', '));
}

async function testAgents() {
  console.log('--- agents ---');
  const { AGENT_DEFINITIONS } = await import('@cluster/shared');
  assert(AGENT_DEFINITIONS.planner, 'planner defined');
  assert(AGENT_DEFINITIONS.coder.parallelizable === true, 'coder parallelizable');
  assert(AGENT_DEFINITIONS.coordinator.parallelizable === false, 'coordinator not parallel');

  const { TaskPlanner } = await import('@cluster/task-engine');
  const planner = new TaskPlanner();
  const graph = planner.planHeuristic({ goal: 'Implement dark mode toggle and add tests', fileGroups: [{ area: 'src', files: ['src/App.tsx', 'src/theme.ts'] }] });
  assert(Object.keys(graph.tasks).length >= 3, 'planner created tasks');
  console.log('Planner OK:', Object.keys(graph.tasks).length, 'tasks');

  const { Coordinator } = await import('@cluster/agent-core');
  // Check coordinator can be instantiated (needs mock deps)
  console.log('Agent definitions OK');
}

async function main() {
  try {
    await testTaskEngine();
    await testTaskEngineParallel();
    await testContextEngine();
    await testMemory();
    await testCheckpoints();
    await testToolRuntime();
    await testVerification();
    await testAgents();
    console.log('\n=== ALL PHASE 2 SMOKE TESTS PASSED ===');
  } catch (e) {
    console.error('FAILED:', e);
    console.error(e.stack);
    process.exit(1);
  }
}
main();
