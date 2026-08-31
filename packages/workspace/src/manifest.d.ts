import type { PackageManager, ProjectKind } from '@cluster/shared';
export interface ManifestInfo {
    kind: ProjectKind;
    packageManager: PackageManager | null;
    name: string | null;
    scripts: Record<string, string>;
}
/**
 * Read whichever manifest is present at the project root. Manifests are
 * advisory: a missing or malformed manifest must never break startup, so every
 * read is best-effort.
 */
export declare function readManifest(root: string, manifests: string[]): Promise<ManifestInfo>;
//# sourceMappingURL=manifest.d.ts.map