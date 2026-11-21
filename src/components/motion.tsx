"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  // Where the next count starts: zero on first paint, then the previous value,
  // so new data after a collection re-counts from the old figure to the new one
  // instead of dropping to zero and climbing all the way back.
  const from = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current ?? 0;
    from.current = value;
    if (reducedMotion() || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      // easeOutExpo: most of the distance early, then a long settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(start + (value - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(start);
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

/**
 * Glows once when `watch` changes after first paint, e.g. a property card whose
 * figures moved because a collection brought in new reviews. First paint never
 * glows: on page load nothing has "changed".
 */
export function Flash({
  watch,
  children,
  className = "",
}: {
  watch: string;
  children: ReactNode;
  className?: string;
}) {
  const previous = useRef(watch);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (previous.current === watch) return;
    previous.current = watch;
    setFlashing(true);
    const id = window.setTimeout(() => setFlashing(false), 1800);
    return () => window.clearTimeout(id);
  }, [watch]);

  return (
    <div className={`flash ${className}`} data-flash={flashing || undefined}>
      {children}
    </div>
  );
}

const FreshIds = createContext<ReadonlySet<number>>(new Set());
const FRESH_MS = 6000;

/**
 * Marks items that arrived since the page was first shown, e.g. reviews a
 * collection just brought in. Ids present on first paint are never "new", so a
 * plain page load shows no badges. The marks clear themselves after a few
 * seconds, with or without animation.
 */
export function FreshScope({
  ids,
  children,
}: {
  ids: number[];
  children: ReactNode;
}) {
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set(ids));
  // Worked out during render, not in an effect, so a new item is marked in the
  // same paint it appears in rather than flashing unmarked for a frame.
  const fresh = new Set(ids.filter((id) => !seen.has(id)));
  const key = [...fresh].join(",");

  useEffect(() => {
    if (!key) return;
    const id = window.setTimeout(
      () => setSeen((s) => new Set([...s, ...ids])),
      FRESH_MS,
    );
    return () => window.clearTimeout(id);
    // `key` captures exactly the change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <FreshIds.Provider value={fresh}>{children}</FreshIds.Provider>;
}

/** A list item that slides in when FreshScope says it just arrived. */
export function FreshItem({
  id,
  className = "",
  children,
}: {
  id: number;
  className?: string;
  children: ReactNode;
}) {
  const fresh = useContext(FreshIds).has(id);
  return (
    <li className={`${className} ${fresh ? "fresh-in" : ""}`}>{children}</li>
  );
}

/** A small "New" tag for an item FreshScope says just arrived. */
export function FreshBadge({ id }: { id: number }) {
  if (!useContext(FreshIds).has(id)) return null;
  return <span className="fresh-badge">New</span>;
}

/**
 * Holds back draw-in animations inside it until it scrolls into view, so rings
 * further down the page fill as the reader reaches them instead of finishing
 * off-screen. Only the drawing waits: the numbers are rendered from the start.
 * Content already on screen at load, and every reader who asked for reduced
 * motion, gets the normal behaviour.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("shown");
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={state === "idle" ? undefined : state}
    >
      {children}
    </div>
  );
}
