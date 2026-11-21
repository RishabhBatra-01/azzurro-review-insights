import { ViewTransition, type ReactNode } from "react";

/** Transition type carried by links that move between pages of the app. */
export const PAGE_NAV = ["nav-page"];

/**
 * Animates a page in and out when the reader moves between pages.
 *
 * Only navigations tagged with PAGE_NAV slide; a page arriving after its
 * loading skeleton fades in. Everything else — Refresh, Collect now, the
 * browser's back button — has no transition type and stays still, so a data
 * refresh never sends the whole page sliding. Browsers without the View
 * Transitions API simply swap the page, as before.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-page": "page-in", default: "page-reveal" }}
      exit={{ "nav-page": "page-out", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/** The loading skeleton's half of the hand-off: it slides in on navigation
 *  and fades out quickly when the real page is ready. */
export function SkeletonTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-page": "page-in", default: "none" }}
      exit={{ "nav-page": "page-out", default: "skeleton-out" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
