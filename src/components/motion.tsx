"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that counts up to its value on first paint.
 *
 * The server renders the real value, so with JavaScript off, or with reduced
 * motion requested, the correct figure is simply there. Screen readers get the
 * final value from a hidden copy rather than hearing the animation's frames.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1100,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo: most of the distance early, then a long settle.
      setShown(value * (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const final = `${prefix}${value.toFixed(decimals)}${suffix}`;
  return (
    <>
      <span aria-hidden="true">
        {prefix}
        {shown.toFixed(decimals)}
        {suffix}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

/**
 * Feeds the pointer position to every `.spotlight` card inside it, through one
 * delegated listener rather than one per card. Does nothing on touch screens,
 * where there is no pointer to follow.
 */
export function SpotlightField({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (
      !root ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(
        ".spotlight",
      );
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - box.left}px`);
        card.style.setProperty("--my", `${event.clientY - box.top}px`);
      });
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
