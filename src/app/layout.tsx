import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/header";
import "./globals.css";

// Plausible analytics — cookieless, no consent banner required, GDPR-clean.
// `data-domain` should match the production hostname; localhost hits are
// ignored by Plausible by default. We load with `defer` so it never blocks
// first paint and gate on NODE_ENV=production so dev iteration doesn't
// pollute the dashboard.
const PLAUSIBLE_DOMAIN = "scapestack.app";

export const metadata: Metadata = {
  // Punchier than the old "Scapestack — OSRS toolkit" — the new tagline
  // hints at *what* the tools do rather than just labelling the category.
  // Per-page templates still take precedence (e.g. "Bank Organizer · Scapestack").
  title: {
    default: "Scapestack · Smart OSRS tools",
    template: "%s · Scapestack"
  },
  description: "Smart OSRS tools — auto-organize your bank, calculate boss DPS, track every untradeable goal. Free, no account, runs in your browser."
};

export const viewport: Viewport = {
  themeColor: "#07090C"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="h-full subpixel-antialiased font-sans">
        {process.env.NODE_ENV === "production" && (
          <Script
            defer
            strategy="afterInteractive"
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
        {/* No sidebar — header carries nav. Removes ~56px of horizontal
            chrome on every page and feels less app-y for a tools landing
            page. The Sidebar component is retained in the codebase in case
            we add enough tools to warrant it again later. */}
        <div className="min-h-full flex flex-col">
          <Header />
          <div className="flex-1 min-h-0">{children}</div>
          <footer className="shrink-0 border-t border-[var(--color-border)] py-4 px-6 text-center text-[11px] text-[var(--color-text-muted)] tracking-wide">
            Built by{" "}
            <a
              href="https://webstability.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline decoration-dotted underline-offset-2"
            >
              Webstability
            </a>
            {" — made for Gielinor"}
          </footer>
        </div>
      </body>
    </html>
  );
}
