import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/header";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { RouteVisitTracker } from "@/components/route-visit-tracker";
import {
  BRAND_DESCRIPTION,
  BRAND_KEYWORDS,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_THEME_COLOR,
  BRAND_URL
} from "@/lib/brand";
import "./globals.css";

// Plausible analytics — cookieless, no consent banner required, GDPR-clean.
// `data-domain` should match the production hostname; localhost hits are
// ignored by Plausible by default. We load with `defer` so it never blocks
// first paint and gate on NODE_ENV=production so dev iteration doesn't
// pollute the dashboard.
/**
 * The typeface, actually delivered.
 *
 * Measured 2026-08-01: the site loaded ZERO webfonts. --font-sans named
 * "Atkinson Hyperlegible", "Avenir Next", "Inter" and "Segoe UI", and on a
 * live page none of the first three resolved — the site rendered in Avenir
 * Next on macOS, Segoe UI on Windows and Roboto on Android. Three faces, none
 * chosen, two of them the literal system UI font of their platform. A product
 * cannot read as anything but a generic web app while that is true.
 *
 * Atkinson Hyperlegible was the wrong ask even if it had loaded: it is the
 * Braille Institute's accessibility face, engineered so low-vision readers
 * cannot confuse letterforms. Deliberately characterless — a road sign.
 *
 * Archivo is a grotesque built for dense interfaces: sturdy at 11px, confident
 * at 40px, real tabular figures, and not the face every product reaches for.
 * Self-hosted by next/font at build time, so there is no external request and
 * no flash of fallback. Swapping it is one line here.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  // 400 body, 600 subject, 800 the answer and the wordmark. Hierarchy is
  // carried by weight and size, never by a second family.
  weight: ["400", "600", "800"]
});

const PLAUSIBLE_DOMAIN = "scapestack.org";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_URL),
  applicationName: BRAND_NAME,
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  category: "games",
  keywords: BRAND_KEYWORDS,
  // Punchier than the old "Scapestack — OSRS toolkit" — the new tagline
  // hints at *what* the tools do rather than just labelling the category.
  // Per-page templates still take precedence (e.g. "Can I leave the bank? · Scapestack").
  title: {
    default: `${BRAND_NAME} · ${BRAND_TAGLINE}`,
    template: "%s · Scapestack"
  },
  description: BRAND_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" }
    ]
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} · ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} OSRS decision engine`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} · ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    images: ["/opengraph-image"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND_THEME_COLOR
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`min-h-full ${archivo.variable}`}>
      <body className="min-h-full subpixel-antialiased font-sans">
        {process.env.NODE_ENV === "production" && (
          <>
            {/* Plausible's documented queue stub, and it is load-bearing here.
                The script is deferred, so it does not exist yet when React
                runs its mount effects — and route:visit fires from exactly
                such an effect. Without the queue every landing visit was
                dropped while its localStorage timestamp was still written, so
                the next arrival read as a return with no first visit ever
                recorded. That biased the return rate up; the docs claim it is
                biased down. */}
            <Script id="plausible-queue" strategy="beforeInteractive">
              {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}"}
            </Script>
            <Script
              defer
              strategy="afterInteractive"
              data-domain={PLAUSIBLE_DOMAIN}
              src="https://plausible.io/js/script.js"
            />
          </>
        )}
        {/* No sidebar — header carries nav. Removes ~56px of horizontal
            chrome on every page and feels less app-y for a tools landing
            page. The Sidebar component is retained in the codebase in case
            we add enough tools to warrant it again later. */}
        <div className="min-h-full flex flex-col">
          <Header />
          <div className="mobile-content-safe flex-1 min-h-0">{children}</div>
          <MobileActionBar />
          <RouteVisitTracker />
          <footer className="mobile-footer-safe shrink-0 border-t border-[var(--color-border)] py-4 px-6 text-center text-[length:var(--text-label)] font-normal text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text-secondary)]">{BRAND_NAME}</span>
            {" · "}
            <span>{BRAND_TAGLINE}</span>
            {" · Made for Gielinor"}
          </footer>
        </div>
      </body>
    </html>
  );
}
