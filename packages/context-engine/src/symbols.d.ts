/**
 * Symbol / function extraction.
 *
 * Lightweight, regex-based extraction without tree-sitter for portability.
 * Falls back gracefully when parsing fails; used to build smarter context.
 */
export interface SymbolInfo {
    name: string;
    kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'import' | 'export';
    line: number;
    signature: string;
    file: string;
}
export declare function extractSymbols(file: string, content: string): SymbolInfo[];
export declare function symbolsToSummary(symbols: SymbolInfo[], max?: number): string;
export declare function findSymbol(symbols: SymbolInfo[], name: string): SymbolInfo | undefined;
export declare function filterRelevantSymbols(symbols: SymbolInfo[], query: string): SymbolInfo[];
//# sourceMappingURL=symbols.d.ts.map