import type { Metadata } from "next";
import "./globals.css";
import { MobileNav, Sidebar } from "../components/sidebar";
import { display, sans } from "./fonts";

export const metadata: Metadata = {
  title: "Azzurro Hotels — Guest Review Insights",
  description:
    "Weekly guest sentiment and operational issues across four Sydney properties.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:shadow-[var(--shadow-raised)]"
        >
          Skip to content
        </a>

        {/* Fixed rather than a flex column, so the long overview scrolls
            under a nav that stays put. */}
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden w-[264px] overflow-y-auto border-r border-[var(--nav-border)] lg:block"
          style={{
            background:
              "linear-gradient(180deg, var(--nav-bg) 0%, var(--nav-raised) 55%, var(--nav-bg) 100%)",
          }}
        >
          <Sidebar />
        </aside>

        <MobileNav />

        <div className="lg:pl-[264px]">
          <main
            id="main"
            className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8"
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
