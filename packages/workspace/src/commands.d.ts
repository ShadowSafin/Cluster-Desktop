import type { ManifestInfo } from './manifest.js';
export interface InferredCommands {
    build: string[];
    test: string[];
    lint: string[];
    format: string[];
}
/**
 * Infer likely verification commands.
 *
 * These are *suggestions* for the agent, not trusted defaults: every one of
 * them still goes through the normal confirmation and execution path.
 */
export declare function inferCommands(manifest: ManifestInfo): InferredCommands;
/** Flatten to a compact, prompt-friendly list. */
export declare function describeCommands(commands: InferredCommands): string[];
//# sourceMappingURL=commands.d.ts.map