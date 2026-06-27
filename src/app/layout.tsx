import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/header";
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
  // Per-page templates still take precedence (e.g. "Bank Organizer · Scapestack").
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
  themeColor: BRAND_THEME_COLOR
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
