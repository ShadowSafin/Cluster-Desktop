import { createId, createMemoryEntry, type MemoryEntry, type MemoryCategory } from '@cluster/shared';
import { type MemoryDatabase } from './database.js';
import { generateSemanticEmbedding, cosineSimilarity } from './vector.js';

export interface TaskOutcomeContext {
  sessionId: string;
  projectRoot: string;
  goal: string;
  summary: string;
  success: boolean;
  filesChanged?: string[];
  commandsRun?: string[];
  errorEncountered?: string;
  fixApplied?: string;
  plan?: any;
  userCorrection?: string;
}

export interface PromptExtractionContext {
  projectRoot: string;
  sessionId?: string;
}

export class MemoryExtractor {
  constructor(private db: MemoryDatabase) {}

  /**
   * Evaluates user prompt for durable knowledge, goals, preferences, architecture,
   * commands, and constraints, returning extracted memories.
   */
  async extractFromPrompt(
    prompt: string,
    context: PromptExtractionContext,
  ): Promise<MemoryEntry[]> {
    const trimmed = (prompt || '').trim();
    if (!trimmed || trimmed.length < 12) return [];

    // 1. Noise Rejection: Reject greetings, short acknowledgements, trivial confirmations
    if (/^(hi|hello|hey|yo|yes|no|ok|okay|sure|thanks|thank you|proceed|continue|good|start)[.!]?$/i.test(trimmed)) {
      return [];
    }

    const saved: MemoryEntry[] = [];

    // 2. Project Goals & Vision ('project')
    const goalMatch =
      /(?:building|create|developing|goal is to|project is|working on|build(?:ing)? a(?:n)?)\s+([^.,\n]{10,120})/i.exec(
        trimmed,
      );
    if (goalMatch) {
      const goalText = goalMatch[1].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `goal:${this.slugify(goalText).slice(0, 40)}`,
        title: `Project Goal: ${goalText.slice(0, 60)}`,
        summary: `Goal declared in prompt: ${goalText}`,
        value: `Active project goal: "${goalText}"\nWorkspace: ${context.projectRoot}`,
        category: 'project',
        scope: 'project',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'extraction',
        importance: 0.75,
        confidence: 0.9,
        tags: ['project-goal', 'vision'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    // 3. UI & Visual Style Preferences ('ui_style')
    const uiStyleRegex =
      /(?:always\s+use|prefer|use|style with|theme is|ui should be)\s+([^.,\n]*(?:dark\s*theme|dark\s*mode|light\s*theme|glassmorphism|minimalist|tailwind|compact|framer-motion|rounded-[\w]+|modern\s*ui|clean\s*design)[^.,\n]*)/i;
    const uiMatch = uiStyleRegex.exec(trimmed);
    if (uiMatch) {
      const uiPref = uiMatch[1].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `ui:${this.slugify(uiPref).slice(0, 40)}`,
        title: `UI Style: ${uiPref.slice(0, 50)}`,
        summary: `User UI preference: ${uiPref}`,
        value: `UI & Visual Guideline: "${uiPref}" for workspace ${context.projectRoot}`,
        category: 'ui_style',
        scope: 'project',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'user',
        importance: 0.85,
        confidence: 0.95,
        tags: ['ui-style', 'theme', 'design'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    // 4. Coding Conventions & Directives ('user_preference' / 'convention')
    const codePrefRegex =
      /(?:always|never|prefer|please remember to|do not use|stick to|make sure to use)\s+([a-zA-Z0-9_\-\.\s]{5,90})/i;
    const codePrefMatch = codePrefRegex.exec(trimmed);
    if (codePrefMatch && !uiMatch) {
      const prefText = codePrefMatch[0].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `pref:${this.slugify(prefText).slice(0, 40)}`,
        title: `Directive: ${prefText.slice(0, 50)}`,
        summary: prefText,
        value: `User coding preference: "${trimmed}"`,
        category: 'user_preference',
        scope: 'project',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'user',
        importance: 0.8,
        confidence: 0.9,
        tags: ['user-preference', 'directive'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    // 5. Provider / Model Preferences ('provider_model')
    const modelMatch =
      /(?:use model|preferred model|provider is|use provider|switch to model|default model)\s+([a-zA-Z0-9_\-\:\.\/]{3,50})/i.exec(
        trimmed,
      );
    if (modelMatch) {
      const modelName = modelMatch[1].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `model:${this.slugify(modelName)}`,
        title: `Model Preference: ${modelName}`,
        summary: `User prefers provider/model: ${modelName}`,
        value: `Preferred Model: ${modelName}\nSpecified in workspace: ${context.projectRoot}`,
        category: 'provider_model',
        scope: 'global',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'user',
        importance: 0.8,
        confidence: 0.95,
        tags: ['provider-model', 'ai-config'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    // 6. Architecture Decisions & Frameworks ('architecture')
    const archMatch =
      /(?:architecture|stack|library|framework|database|state management)\s+(?:is|should be|use)\s+([^.,\n]{5,80})/i.exec(
        trimmed,
      );
    if (archMatch) {
      const archText = archMatch[1].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `arch:${this.slugify(archText).slice(0, 40)}`,
        title: `Architecture: ${archText.slice(0, 50)}`,
        summary: `Architecture decision: ${archText}`,
        value: `Architectural specification: ${archText}\nContext: "${trimmed}"`,
        category: 'architecture',
        scope: 'project',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'user',
        importance: 0.85,
        confidence: 0.9,
        tags: ['architecture', 'tech-stack'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    // 7. Workflow Preferences ('workflow')
    const workflowMatch =
      /(?:workflow|test first|tdd|always verify|deploy with|commit style)\s+([^.,\n]{5,80})/i.exec(
        trimmed,
      );
    if (workflowMatch) {
      const wfText = workflowMatch[1].trim();
      const entry = createMemoryEntry({
        id: createId('mem'),
        key: `wf:${this.slugify(wfText).slice(0, 40)}`,
        title: `Workflow: ${wfText.slice(0, 50)}`,
        summary: `Preferred workflow: ${wfText}`,
        value: `Workflow rule: ${wfText}`,
        category: 'workflow',
        scope: 'project',
        projectRoot: context.projectRoot,
        sessionId: context.sessionId,
        source: 'user',
        importance: 0.75,
        confidence: 0.85,
        tags: ['workflow', 'process'],
      });
      const stored = await this.saveOrDeduplicate(entry);
      if (stored) saved.push(stored);
    }

    return saved;
  }

  /**
   * Extracts memories from task completion, plans, code changes, and resolved bugs.
   */
  async extractFromTaskOutcome(ctx: TaskOutcomeContext): Promise<MemoryEntry[]> {
    const saved: MemoryEntry[] = [];

    // 1. Task Summary Memory
    if (ctx.goal && ctx.summary && ctx.summary !== 'Finished.') {
      const taskMemory = createMemoryEntry({
        id: createId('mem'),
        key: `task:${this.slugify(ctx.goal).slice(0, 40)}`,
        title: `Task: ${ctx.goal.slice(0, 60)}`,
        summary: ctx.summary.slice(0, 150),
        value: `Goal: ${ctx.goal}\nOutcome: ${ctx.summary}\nStatus: ${ctx.success ? 'Success' : 'Failed'}`,
        category: 'task',
        scope: 'project',
        projectRoot: ctx.projectRoot,
        sessionId: ctx.sessionId,
        source: 'extraction',
        importance: ctx.success ? 0.6 : 0.4,
        confidence: 0.9,
        tags: ['task-outcome', ctx.success ? 'status:success' : 'status:failed'],
      });
      const stored = await this.saveOrDeduplicate(taskMemory);
      if (stored) saved.push(stored);
    }

    // 2. Bug Fix Memory (Very high importance for future recall)
    if (ctx.errorEncountered && ctx.fixApplied) {
      const bugMemory = createMemoryEntry({
        id: createId('mem'),
        key: `bug:${this.slugify(ctx.errorEncountered).slice(0, 40)}`,
        title: `Bug Fix: ${ctx.errorEncountered.slice(0, 50)}`,
        summary: `Resolved: ${ctx.fixApplied.slice(0, 140)}`,
        value: `Issue Encountered:\n${ctx.errorEncountered}\n\nResolution / Fix Applied:\n${ctx.fixApplied}`,
        category: 'bug',
        scope: 'project',
        projectRoot: ctx.projectRoot,
        sessionId: ctx.sessionId,
        source: 'extraction',
        importance: 0.85,
        confidence: 0.95,
        tags: ['bug-fix', 'troubleshooting'],
      });
      const stored = await this.saveOrDeduplicate(bugMemory);
      if (stored) saved.push(stored);
    }

    // 3. Architectural Decisions from Plan
    if (ctx.plan?.strategy) {
      const archEntry = createMemoryEntry({
        id: createId('mem'),
        key: `arch-plan:${this.slugify(ctx.plan.strategy).slice(0, 40)}`,
        title: `Architecture Strategy: ${ctx.plan.strategy.slice(0, 50)}`,
        summary: ctx.plan.strategy.slice(0, 140),
        value: `Strategy: ${ctx.plan.strategy}\nAlternatives Considered: ${(ctx.plan.alternativesConsidered || []).join(', ')}\nGoal: ${ctx.goal}`,
        category: 'architecture',
        scope: 'project',
        projectRoot: ctx.projectRoot,
        sessionId: ctx.sessionId,
        source: 'agent',
        importance: 0.8,
        confidence: 0.9,
        tags: ['architecture', 'strategy'],
      });
      const stored = await this.saveOrDeduplicate(archEntry);
      if (stored) saved.push(stored);
    }

    // 4. Important Modified Files
    if (ctx.filesChanged && ctx.filesChanged.length > 0) {
      for (const filePath of ctx.filesChanged.slice(0, 3)) {
        const basename = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
        const fileMemory = createMemoryEntry({
          id: createId('mem'),
          key: `file:${basename}`,
          title: `File: ${basename}`,
          summary: `Core file modified for: ${ctx.goal.slice(0, 80)}`,
          value: `File ${filePath} is actively used in project architecture for: ${ctx.goal}`,
          category: 'file',
          scope: 'project',
          projectRoot: ctx.projectRoot,
          sessionId: ctx.sessionId,
          source: 'extraction',
          importance: 0.7,
          confidence: 0.85,
          tags: ['important-file', basename.split('.').pop() || 'code'],
          metadata: { path: filePath },
        });
        const stored = await this.saveOrDeduplicate(fileMemory);
        if (stored) saved.push(stored);
      }
    }

    // 5. Successful Setup / Build Commands
    if (ctx.commandsRun && ctx.commandsRun.length > 0) {
      for (const cmd of ctx.commandsRun.slice(0, 2)) {
        if (/npm\s+(i|install|run|test|build)|pnpm|yarn|cargo|pytest/i.test(cmd)) {
          const cmdMemory = createMemoryEntry({
            id: createId('mem'),
            key: `cmd:${this.slugify(cmd).slice(0, 40)}`,
            title: `Command: ${cmd.slice(0, 50)}`,
            summary: `Working command in workspace: ${cmd}`,
            value: `$ ${cmd}\nSuccessfully verified in workspace ${ctx.projectRoot}.`,
            category: 'command',
            scope: 'project',
            projectRoot: ctx.projectRoot,
            sessionId: ctx.sessionId,
            source: 'extraction',
            importance: 0.65,
            confidence: 0.9,
            tags: ['verified-command'],
          });
          const stored = await this.saveOrDeduplicate(cmdMemory);
          if (stored) saved.push(stored);
        }
      }
    }

    // 6. User Correction Detection (e.g. "Instead of X, use Y")
    if (ctx.userCorrection) {
      const correctionMatch =
        /(?:no|stop|don't|instead of)\s+([a-zA-Z0-9_\-\s]{3,40})\s+(?:use|do|switch to)\s+([a-zA-Z0-9_\-\s]{3,40})/i.exec(
          ctx.userCorrection,
        );
      if (correctionMatch) {
        const oldPattern = correctionMatch[1].trim();
        const newPattern = correctionMatch[2].trim();
        const correctionEntry = createMemoryEntry({
          id: createId('mem'),
          key: `correction:${this.slugify(newPattern).slice(0, 40)}`,
          title: `Rule: Use ${newPattern} instead of ${oldPattern}`,
          summary: `User corrected: Replace ${oldPattern} with ${newPattern}`,
          value: `Explicit user correction:\nNever use "${oldPattern}". Always use "${newPattern}".\nContext: ${ctx.userCorrection}`,
          category: 'user_preference',
          scope: 'project',
          projectRoot: ctx.projectRoot,
          sessionId: ctx.sessionId,
          source: 'user',
          importance: 0.9, // Corrections are highest importance
          confidence: 0.98,
          pinned: true,
          tags: ['correction', 'rule', 'pinned-directive'],
        });
        const stored = await this.saveOrDeduplicate(correctionEntry);
        if (stored) saved.push(stored);
      }
    }

    return saved;
  }

  /**
   * Helper alias for backwards compatibility.
   */
  async extractFromUserInput(
    text: string,
    projectRoot: string,
    sessionId?: string,
  ): Promise<MemoryEntry | null> {
    const list = await this.extractFromPrompt(text, { projectRoot, sessionId });
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Deduplicates new memories against existing memories in the database.
   * If an existing memory has the exact key or >= 0.88 semantic similarity,
   * it updates the existing entry and boosts importance.
   */
  private async saveOrDeduplicate(newEntry: MemoryEntry): Promise<MemoryEntry | null> {
    const existing = await this.db.list({
      projectRoot: newEntry.projectRoot,
      category: newEntry.category,
      limit: 100,
    });

    // 1. Exact key match
    const exactMatch = existing.find((e) => e.key === newEntry.key);
    if (exactMatch) {
      const updated = await this.db.update(exactMatch.id, {
        value: newEntry.value,
        summary: newEntry.summary,
        importance: Math.max(exactMatch.importance, newEntry.importance),
        hits: (exactMatch.hits || 0) + 1,
      });
      return updated;
    }

    // 2. Semantic similarity match (>= 0.88)
    const newVec = generateSemanticEmbedding(newEntry.title + ' ' + newEntry.value);
    for (const item of existing) {
      const itemVec = generateSemanticEmbedding(item.title + ' ' + item.value);
      const similarity = cosineSimilarity(newVec, itemVec);
      if (similarity >= 0.88) {
        const updated = await this.db.update(item.id, {
          value: newEntry.value,
          summary: newEntry.summary,
          importance: Math.max(item.importance, newEntry.importance),
          hits: (item.hits || 0) + 1,
        });
        return updated;
      }
    }

    // 3. New unique memory
    return this.db.insert(newEntry, newVec);
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
