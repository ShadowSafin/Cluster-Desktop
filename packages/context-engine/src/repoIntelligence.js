/**
 * Repository intelligence: git diff awareness, package manager,
 * framework detection, test/build command discovery, file grouping.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { execa } from 'execa';
import fg from 'fast-glob';
import { languageForPath } from '@cluster/workspace';
const FRAMEWORK_HINTS = [
    { pattern: /next\.config\.(js|mjs|ts)/, framework: 'nextjs' },
    { pattern: /vite\.config\.(js|ts)/, framework: 'vite' },
    { pattern: /nuxt\.config\.(js|ts)/, framework: 'nuxt' },
    { pattern: /svelte\.config\.js/, framework: 'svelte' },
    { pattern: /angular\.json/, framework: 'angular' },
    { pattern: /tailwind\.config\.(js|ts)/, framework: 'tailwind' },
    { pattern: /prisma\/schema\.prisma/, framework: 'prisma' },
    { pattern: /jest\.config\.(js|ts)/, framework: 'jest' },
    { pattern: /vitest\.config\.(js|ts)/, framework: 'vitest' },
    { pattern: /playwright\.config\.(js|ts)/, framework: 'playwright' },
    { pattern: /drizzle\.config\.(js|ts)/, framework: 'drizzle' },
];
async function detectFrameworks(root) {
    const found = [];
    try {
        const files = await fg(['**/*'], { cwd: root, ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'], onlyFiles: true, deep: 3 });
        for (const file of files) {
            for (const hint of FRAMEWORK_HINTS) {
                if (hint.pattern.test(file) && !found.includes(hint.framework))
                    found.push(hint.framework);
            }
        }
    }
    catch {
        // ignore
    }
    return found;
}
async function detectPackageManager(root) {
    const checks = [
        ['bun.lockb', 'bun'],
        ['pnpm-lock.yaml', 'pnpm'],
        ['yarn.lock', 'yarn'],
        ['package-lock.json', 'npm'],
        ['Cargo.toml', 'cargo'],
        ['go.mod', 'go'],
        ['pyproject.toml', 'pip'],
    ];
    for (const [file, pm] of checks) {
        try {
            await fs.access(path.join(root, file));
            return pm;
        }
        catch {
            continue;
        }
    }
    return null;
}
async function readGitDiff(root) {
    try {
        const [branchRes, diffRes, statusRes] = await Promise.all([
            execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, reject: false, timeout: 4000 }),
            execa('git', ['diff', '--name-only', 'HEAD'], { cwd: root, reject: false, timeout: 4000 }),
            execa('git', ['status', '--porcelain'], { cwd: root, reject: false, timeout: 4000 }),
        ]);
        const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : null;
        const changed = [...new Set([
                ...(diffRes.stdout?.split('\n').filter(Boolean) ?? []),
                ...(statusRes.stdout?.split('\n').map((l) => l.slice(3).trim()).filter(Boolean) ?? []),
            ])].slice(0, 40);
        const summary = changed.length > 0 ? `${changed.length} files changed: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? '…' : ''}` : 'no changes';
        return { branch, changed, summary };
    }
    catch {
        return { branch: null, changed: [], summary: 'not a git repo' };
    }
}
async function discoverCommands(root) {
    const commands = { build: [], test: [], lint: [], format: [] };
    try {
        const pkgRaw = await fs.readFile(path.join(root, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgRaw);
        const scripts = pkg.scripts ?? {};
        const mapping = {
            build: 'build',
            compile: 'build',
            test: 'test',
            'test:unit': 'test',
            check: 'test',
            lint: 'lint',
            eslint: 'lint',
            format: 'format',
            fmt: 'format',
            prettier: 'format',
        };
        for (const [script, kind] of Object.entries(mapping)) {
            if (scripts[script])
                commands[kind].push(scripts[script]);
        }
        if (commands.build.length === 0 && scripts.build)
            commands.build.push(scripts.build);
        if (commands.test.length === 0 && scripts.test)
            commands.test.push(scripts.test);
    }
    catch {
        // no package.json
    }
    // Fallbacks per language
    if (commands.test.length === 0)
        commands.test.push('npm test');
    if (commands.build.length === 0)
        commands.build.push('npm run build');
    return commands;
}
async function groupFiles(root) {
    try {
        const files = await fg(['**/*.{ts,tsx,js,jsx,py,go,rs}'], {
            cwd: root,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**'],
            onlyFiles: true,
        });
        const groups = new Map();
        for (const f of files) {
            const area = f.split('/')[0] ?? 'root';
            const areaNorm = ['src', 'lib', 'app', 'apps', 'packages', 'components'].includes(area) && f.split('/')[1]
                ? `${area}/${f.split('/')[1]}`
                : area;
            const arr = groups.get(areaNorm) ?? [];
            arr.push(f);
            groups.set(areaNorm, arr);
        }
        return [...groups.entries()].map(([area, files]) => ({
            area,
            files: files.slice(0, 20),
            language: languageForPath(files[0] ?? '') ?? undefined,
        })).slice(0, 8);
    }
    catch {
        return [];
    }
}
export async function gatherRepoIntelligence(root) {
    const [frameworks, packageManager, git, fileGroups, commands, languages] = await Promise.all([
        detectFrameworks(root),
        detectPackageManager(root),
        readGitDiff(root),
        groupFiles(root),
        discoverCommands(root),
        detectLanguages(root),
    ]);
    let projectKind = 'unknown';
    if (packageManager === 'npm' || packageManager === 'pnpm' || packageManager === 'yarn' || packageManager === 'bun')
        projectKind = 'node';
    else if (packageManager === 'cargo')
        projectKind = 'rust';
    else if (packageManager === 'go')
        projectKind = 'go';
    else if (packageManager === 'pip' || packageManager === 'poetry')
        projectKind = 'python';
    const testFiles = await findTestFiles(root);
    return {
        root,
        projectKind,
        packageManager,
        frameworks,
        languages,
        commands,
        git: git.branch !== null || git.changed.length > 0 ? { branch: git.branch, recentChangedFiles: git.changed, diffSummary: git.summary } : null,
        fileGroups,
        testFiles,
    };
}
async function detectLanguages(root) {
    try {
        const files = await fg(['**/*'], { cwd: root, ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'], onlyFiles: true });
        const counts = new Map();
        for (const f of files) {
            const lang = languageForPath(f);
            if (lang)
                counts.set(lang, (counts.get(lang) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l);
    }
    catch {
        return [];
    }
}
async function findTestFiles(root) {
    try {
        const files = await fg(['**/*.{test,spec}.{ts,tsx,js,jsx,py,go}', '**/__tests__/**/*'], {
            cwd: root,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
            onlyFiles: true,
        });
        return files.slice(0, 20);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=repoIntelligence.js.map