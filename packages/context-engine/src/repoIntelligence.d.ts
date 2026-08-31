/**
 * Repository intelligence: git diff awareness, package manager,
 * framework detection, test/build command discovery, file grouping.
 */
export interface RepoIntelligence {
    root: string;
    projectKind: string;
    packageManager: string | null;
    frameworks: string[];
    languages: string[];
    commands: {
        build: string[];
        test: string[];
        lint: string[];
        format: string[];
    };
    git: {
        recentChangedFiles: string[];
        branch: string | null;
        diffSummary: string;
    } | null;
    fileGroups: Array<{
        area: string;
        files: string[];
        language?: string;
    }>;
    testFiles: string[];
}
export declare function gatherRepoIntelligence(root: string): Promise<RepoIntelligence>;
//# sourceMappingURL=repoIntelligence.d.ts.map