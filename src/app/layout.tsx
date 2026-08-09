import type { Metadata, Viewport } from "next";
import { Cinzel, Fraunces, Pixelify_Sans } from "next/font/google";
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
 * Three faces, three jobs — REBRAND.md Section 2.
 *
 * All SIL OFL 1.1, self-hosted by next/font at build time, so there is no
 * external request and no flash of fallback.
 *
 * What this replaces, and why. The site carried Archivo plus RuneStar's CC0
 * recreations of the game's own interface fonts. Archivo is a competent
 * grotesque and exactly the "safe" choice the rebrand exists to escape. The
 * RuneStar faces had a second problem: they reproduce Jagex letterforms, and
 * REBRAND.md 9.4 rules out font recreations under the Fan Content Policy.
 *
 * Cinzel earns the same feeling honestly. It is a Roman-inscription serif, so
 * it reads as carved stone by construction rather than by imitating a game
 * asset — and unlike the bitmap faces it is crisp at any size, which removes
 * the 16px-multiples-only constraint the old system had to enforce in a test.
 */
const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cinzel",
  weight: ["600", "700"]
});

/**
 * Fraunces for everything a player reads. An old-style serif with an optical
 * WONK axis — warm and editorial, which is what an almanac is, and audibly not
 * a product sans.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"]
});

/**
 * Numerals only: KC, levels, gp, XP, timers. Never prose.
 *
 * A pixel face gives game numbers the texture of the game without borrowing
 * anything from it. Restricted to `.numeral` so it cannot leak into a
 * paragraph, where it would be a novelty rather than an interface.
 */
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify",
  weight: ["500", "700"]
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
    <html lang="en" className={`min-h-full ${cinzel.variable} ${fraunces.variable} ${pixelifySans.variable}`}>
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
            {/* REBRAND.md 9.4. Two obligations, both required to ship.

                The sprites come from the OSRS Wiki under CC BY-NC-SA 3.0 —
                attribution AND non-commercial. The licence link goes to the
                wiki's copyright page; the ?action=history link is the wiki's
                own accepted method of crediting a reused page.

                NON-COMMERCIAL IS A REAL CONSTRAINT, NOT A FORMALITY: the day
                Scapestack charges for anything, these sprites have to be
                replaced or separately licensed. Do not ship a paid feature
                without settling that first. */}
            <span className="mt-2 block text-[var(--color-text-muted)]">
              Item and skill icons from the{" "}
              <a
                href="https://oldschool.runescape.wiki/w/Old_School_RuneScape_Wiki:Copyrights"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                OSRS Wiki, CC BY-NC-SA 3.0
              </a>
              .
            </span>
            <span className="mt-1 block text-[var(--color-text-muted)]">
              Created using intellectual property belonging to Jagex Ltd under the Jagex Fan Content Policy.
              Not endorsed by or affiliated with Jagex.
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
