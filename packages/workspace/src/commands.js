const SCRIPT_CANDIDATES = {
    build: ['build', 'compile', 'bundle'],
    test: ['test', 'test:unit', 'check'],
    lint: ['lint', 'eslint'],
    format: ['format', 'fmt', 'prettier'],
};
function pick(scripts, candidates) {
    const out = [];
    for (const candidate of candidates) {
        const value = scripts[candidate];
        if (value)
            out.push(value);
    }
    return out;
}
/**
 * Infer likely verification commands.
 *
 * These are *suggestions* for the agent, not trusted defaults: every one of
 * them still goes through the normal confirmation and execution path.
 */
export function inferCommands(manifest) {
    const commands = {
        build: pick(manifest.scripts, SCRIPT_CANDIDATES.build),
        test: pick(manifest.scripts, SCRIPT_CANDIDATES.test),
        lint: pick(manifest.scripts, SCRIPT_CANDIDATES.lint),
        format: pick(manifest.scripts, SCRIPT_CANDIDATES.format),
    };
    switch (manifest.kind) {
        case 'node': {
            const pm = manifest.packageManager ?? 'npm';
            const run = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm run';
            if (commands.build.length === 0 && manifest.scripts['build'])
                commands.build.push(manifest.scripts['build']);
            if (commands.test.length === 0 && manifest.scripts['test'])
                commands.test.push(manifest.scripts['test']);
            if (commands.build.length === 0)
                commands.build.push('npx tsc --noEmit');
            if (commands.test.length === 0)
                commands.test.push(`${run} test`);
            break;
        }
        case 'python':
            if (commands.test.length === 0)
                commands.test.push('pytest -q');
            if (commands.lint.length === 0)
                commands.lint.push('ruff check .');
            if (commands.format.length === 0)
                commands.format.push('ruff format .');
            break;
        case 'go':
            commands.build = commands.build.length > 0 ? commands.build : ['go build ./...'];
            commands.test = commands.test.length > 0 ? commands.test : ['go test ./...'];
            commands.lint = commands.lint.length > 0 ? commands.lint : ['go vet ./...'];
            commands.format = commands.format.length > 0 ? commands.format : ['gofmt -l .'];
            break;
        case 'rust':
            commands.build = commands.build.length > 0 ? commands.build : ['cargo build'];
            commands.test = commands.test.length > 0 ? commands.test : ['cargo test'];
            commands.lint = commands.lint.length > 0 ? commands.lint : ['cargo clippy'];
            commands.format = commands.format.length > 0 ? commands.format : ['cargo fmt'];
            break;
        default:
            break;
    }
    return commands;
}
/** Flatten to a compact, prompt-friendly list. */
export function describeCommands(commands) {
    const out = [];
    for (const [kind, list] of Object.entries(commands)) {
        for (const command of list.slice(0, 2))
            out.push(`${kind}: ${command}`);
    }
    return out;
}
//# sourceMappingURL=commands.js.map