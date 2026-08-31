import { useEffect, useState } from 'react';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

/**
 * Braille spinner frame.
 *
 * A component-local timer is used instead of a spinner dependency: it is ten
 * lines, it pauses correctly when `active` is false, and it avoids holding the
 * event loop open.
 */
export function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return active ? (FRAMES[frame] ?? '⠋') : ' ';
}
