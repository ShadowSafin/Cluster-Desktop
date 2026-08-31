import { toPosix } from '@cluster/shared';
export interface DetectResult {
    root: string;
    /** Marker that caused this directory to be chosen, if any. */
    marker: string | null;
    /** True when we fell back to `startDir` because nothing was found. */
    fallback: boolean;
}
export declare function detectProjectRoot(startDir?: string): Promise<DetectResult>;
/** Manifest files present directly at the project root. */
export declare function findManifests(root: string): Promise<string[]>;
export declare function languageForPath(filePath: string): string | null;
export declare function languageForExtensionCount(counts: Map<string, number>): string[];
export { toPosix };
//# sourceMappingURL=detect.d.ts.map