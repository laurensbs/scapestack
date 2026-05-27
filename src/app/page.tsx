import Link from "next/link";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { SampleBankLink } from "@/components/sample-bank-link";
import { BossShowcase } from "@/components/boss-showcase";
import { HeroSubhead } from "@/components/hero-subhead";
import { HeroIntake } from "@/components/hero-intake";

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-14 pb-24">
      {/* Hero */}
      <section className="mb-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <div
              className="eyebrow flex items-center gap-2 mb-5"
              style={{ animation: "hero-fade 0.65s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}
            >
              <span className="size-1.5 rounded-full bg-[var(--color-accent)] animate-[mint-pulse-dot_2.6s_ease-in-out_infinite]" />
              <span>v0.4 · OSRS toolkit</span>
            </div>
            <h1
              // Mobile gets text-[36px] so "Gielinor" doesn't wrap onto a
              // third line on 375px viewports (audit finding #1). Larger
              // breakpoints keep the original premium size.
              className="text-[36px] sm:text-[48px] md:text-[64px] lg:text-[72px] font-bold leading-[0.95] tracking-[-0.02em] text-[var(--color-text)]"
              // Longer duration + later start gives the headline its own moment;
              // the eyebrow above settles first, then the title lifts in.
              style={{ animation: "hero-fade 0.85s cubic-bezier(0.22,1,0.36,1) 0.15s both" }}
            >
              Less bank standing,<br />
              <span className="text-gold-gradient">more Gielinor.</span>
            </h1>
            <HeroSubhead />
            {/* Inline intake — geen tussenstap meer. User typt naam,
                drukt Generate → /next runt direct met shuffle-loading. */}
            <div
              className="mt-8"
              style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.48s both" }}
            >
              <HeroIntake />
              <div className="mt-3 text-center sm:text-left">
                <SampleBankLink />
              </div>
            </div>
          </div>

          {/* Boss showcase — gallery-style. One full-bleed boss portrait
              at a time, cross-fading every 5s. Replaces the orbit-of-8
              arena which read as 'budget carousel.' One boss owning
              the column is more premium than eight tiny circles
              competing. Click navigates to /dps for solo bosses, /next
              for raids; dots below are manual selectors + pause-on-
              hover handles 'wait, let me read that one.' */}
          <div
            className="relative mt-6 lg:mt-0"
            style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}
          >
            <BossShowcase />
          </div>
        </div>
      </section>

      {/* 'More tools' card grid removed — the homepage is /next, and the
          tool-card sprites + 3-2 grid asymmetry weren't reading as
          premium. Header + sidebar still surface Bank/DPS/Goals as
          direct nav; cached /tool URLs work unchanged. */}

      {/* Plugin-status callout. Intentionally small + below the fold:
          we don't want to over-promise something Jagex still has to
          approve. When the PR merges this whole block becomes the
          install-CTA instead. */}
      <div className="mt-20 mb-4 text-center">
        <a
          href="https://github.com/runelite/plugin-hub/pull/12227"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[12px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"
        >
          <span className="size-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" aria-hidden="true" />
          RuneLite plugin in review · syncs your real quest/diary/CL state for exact recommendations
        </a>
      </div>

      <footer className="mt-4 pt-10 border-t border-[var(--color-border)]">
        <div className="relative overflow-hidden rounded-2xl max-w-3xl mx-auto bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border border-[var(--color-accent)]/25 animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.5), transparent)" }}
          />
          <div
            className="absolute -bottom-32 -right-24 size-80 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ background: "rgba(230, 165, 47, 0.5)" }}
          />

          <div className="relative p-8 sm:p-10 grid sm:grid-cols-[1fr_auto] items-center gap-6">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
                Help keep Scapestack going.
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                I build these tools in my evenings, between job and family. Every coffee
                covers a hosting bill and buys an hour to ship the next tool.
                If something here saved you a trip, it would mean a lot.
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <BuyMeCoffee />
              <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                One-time · from €1 · takes 20 seconds
              </span>
            </div>
          </div>
        </div>
        {/* Bottom tagline removed — the global footer in app/layout.tsx
            ("Built by Webstability — made for Gielinor") sits below the
            BMC block and provides the page's final outro. Having a second
            tagline strip here made the global footer disappear from sight. */}
      </footer>
    </main>
  );
}

