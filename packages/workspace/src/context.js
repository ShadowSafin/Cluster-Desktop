import path from 'node:path';
import { findManifests, languageForPath } from './detect.js';
import { readManifest } from './manifest.js';
import { inferCommands, describeCommands } from './commands.js';
import { readGitState } from './git.js';
import { listFiles } from './files.js';
/**
 * Build a snapshot of the workspace.
 *
 * This is the only place that assembles `WorkspaceInfo`, so the agent, the TUI
 * and the session store all see exactly the same picture of the repository.
 */
export async function loadWorkspaceInfo(root) {
    const manifests = await findManifests(root);
    const manifest = await readManifest(root, manifests);
    const commands = inferCommands(manifest);
    // Run these in parallel: both are I/O bound and independent.
    const [git, listing] = await Promise.all([readGitState(root), listFiles(root, { maxFiles: 5_000 })]);
    const counts = new Map();
    for (const file of listing.files) {
        const language = languageForPath(file);
        if (language)
            counts.set(language, (counts.get(language) ?? 0) + 1);
    }
    const languages = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([language]) => language);
    return {
        root,
        name: manifest.name ?? path.basename(root),
        detectedAt: new Date().toISOString(),
        languages,
        manifestFiles: manifests,
        project: {
            kind: manifest.kind,
            packageManager: manifest.packageManager,
            name: manifest.name,
            scripts: manifest.scripts,
        },
        commands,
        git,
    };
}
/** Compact block injected into the agent's system prompt. */
export function formatWorkspaceContext(info) {
    const lines = [];
    lines.push('## Workspace');
    lines.push(`- Root: ${info.root}`);
    lines.push(`- Project: ${info.name} (kind: ${info.project.kind}${info.project.packageManager ? `, package manager: ${info.project.packageManager}` : ''})`);
    if (info.languages.length > 0)
        lines.push(`- Languages: ${info.languages.join(', ')}`);
    if (info.manifestFiles.length > 0)
        lines.push(`- Manifests: ${info.manifestFiles.join(', ')}`);
    lines.push('');
    lines.push('## Git');
    if (info.git) {
        const g = info.git;
        lines.push(`- Branch: ${g.branch}${g.head ? ` @ ${g.head}` : ''}`);
        lines.push(`- Working tree: ${g.dirty ? `dirty (${g.staged} staged, ${g.unstaged} modified, ${g.untracked} untracked)` : 'clean'}`);
        if (g.lastCommit)
            lines.push(`- Last commit: ${g.lastCommit}`);
    }
    else {
        lines.push('- Not a git repository. Do not attempt git operations.');
    }
    const commandHints = describeCommands(info.commands);
    if (commandHints.length > 0) {
        lines.push('');
        lines.push('## Likely commands (verify before relying on them)');
        for (const hint of commandHints)
            lines.push(`- ${hint}`);
    }
    if (info.project.scripts && Object.keys(info.project.scripts).length > 0) {
        const scripts = Object.entries(info.project.scripts).slice(0, 12);
        lines.push('');
        lines.push('## Available scripts');
        for (const [name, command] of scripts)
            lines.push(`- ${name}: ${command}`);
    }
    return lines.join('\n');
}
/** One-line summary for the status bar. */
export function formatWorkspaceHeadline(info) {
    const parts = [info.name];
    if (info.project.kind !== 'unknown')
        parts.push(info.project.kind);
    if (info.languages.length > 0)
        parts.push(info.languages.slice(0, 2).join('/'));
    return parts.join(' · ');
}
//# sourceMappingURL=context.js.map