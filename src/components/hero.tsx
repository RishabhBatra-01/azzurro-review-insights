import type { ReactNode } from "react";

/**
 * The dark band that opens each page: aurora, dot grid, title. Everything
 * passed in as `children` or `aside` renders inside the `.on-dark` token scope.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="hero on-dark rise px-5 py-6 sm:px-8 sm:py-8">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {/* Two faint beams of light sweeping slowly across the band. */}
      <div className="beams" aria-hidden="true">
        <span />
        <span />
      </div>

      {/* Two columns on wide screens so the aside sits top-right beside the
          title instead of wrapping under it; stacked below xl, where there is
          no room beside the title. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-8">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.4rem] leading-[1.05] tracking-tight sm:text-[3.1rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {aside ? (
          <div className="flex min-w-0 xl:justify-end">{aside}</div>
        ) : null}
      </div>

      {children}
    </section>
  );
}
