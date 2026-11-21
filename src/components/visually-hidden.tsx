import type { ReactNode } from 'react';

/**
 * Hides content visually while leaving it available to screen readers.
 *
 * Use this instead of putting Tailwind's `sr-only` directly on the element —
 * especially on a `<table>`. A table expands past the 1px width the utility
 * sets and ignores its overflow clip, so an sr-only table silently widens the
 * whole page (it added 56px of horizontal scroll at 320px before this).
 * Wrapping in a plain `<div>` clips reliably.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <div className="sr-only">{children}</div>;
}
