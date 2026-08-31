import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  rows: number;
  columns: number;
}

const FALLBACK: TerminalSize = { rows: 24, columns: 80 };

/**
 * Terminal dimensions, re-rendered on resize.
 *
 * Ink re-renders on exit and input but not reliably on terminal resize, so the
 * listener is explicit. Without it the layout would be computed once against
 * the initial window size.
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => ({
    rows: stdout?.rows ?? FALLBACK.rows,
    columns: stdout?.columns ?? FALLBACK.columns,
  }));

  useEffect(() => {
    if (!stdout) return;
    const update = (): void => {
      setSize({ rows: stdout.rows ?? FALLBACK.rows, columns: stdout.columns ?? FALLBACK.columns });
    };
    update();
    stdout.on('resize', update);
    return () => {
      stdout.off('resize', update);
    };
  }, [stdout]);

  return size;
}
