import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { BossShowcase } from "@/components/boss-showcase";
import { HeroIntake } from "@/components/hero-intake";

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 pt-16 sm:pt-24 pb-24">
      {/* ── HERO ─────────────────────────────────────────────────────────
          Apple-style asymmetric split. Tekst + input links met heel veel
          ademruimte; boss showcase rechts als productfoto. Geen
          background-gradient — strakke zwarte canvas zodat de content
          domineert. */}
      <section className="relative mb-24 sm:mb-32">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-32 xl:gap-40 items-center min-h-[80vh]">
          {/* Linkerkolom — leading content. Apple-style reveals:
              - Titel: word-by-word lift+blur, 60ms stagger per woord
              - Subhead: mask-reveal (clip-path animatie)
              - Intake: scale-in + fade
              Alle ease cubic-bezier(0.22,1,0.36,1) — Apple's "ease-out
              expressive" curve. */}
          <div className="space-y-10">
            <h1 className="font-bold leading-[0.95] tracking-[-0.025em] text-[clamp(44px,8vw,88px)]">
              <RevealLine
                text="Less bank standing,"
                delay={100}
                wordStaggerMs={70}
                className="block text-[var(--color-text)]"
              />
              <RevealLine
                text="more Gielinor."
                delay={350}
                wordStaggerMs={80}
                className="block text-gold-gradient"
                style={{
                  animation: "gold-shimmer 6s linear 1.8s infinite",
                  backgroundSize: "200% 100%"
                }}
              />
            </h1>

            <p
              className="text-[17px] sm:text-[19px] text-[var(--color-text)] leading-[1.5] max-w-[520px]"
              style={{
                animation: "hero-mask-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.85s both",
                clipPath: "inset(0 0 100% 0)"
              }}
            >
              Type your OSRS name. We read your stats, your bank, and your collection log —
              and tell you what&apos;s worth doing tonight.
            </p>

            <div
              style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
            >
              <HeroIntake />
            </div>
          </div>

          {/* Rechterkolom — boss showcase als productfoto. Geen halo
              achtergrond; alleen het portret zelf en z'n bestaande
              floating animatie. Komt iets later in dan de tekst,
              voelt alsof hij "naar binnen wandelt." */}
          <div
            className="relative mt-8 lg:mt-0"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
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

// Word-by-word reveal helper voor de hero-titel. Splitst op spaties en
// geeft elk woord een eigen `inline-block` met staggered animation-delay.
// Werkt server-side; geen useEffect of state nodig. Inline-block per
// woord zorgt dat de translate-Y per-woord werkt zonder de baseline te
// breken; whitespace-pre op de container behoudt de spaties tussen woorden.
function RevealLine({
  text,
  delay = 0,
  wordStaggerMs = 60,
  className,
  style,
}: {
  text: string;
  delay?: number;
  wordStaggerMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const words = text.split(" ");
  return (
    <span className={className} style={style}>
      {words.map((w, i) => (
        <span
          key={i}
          // overflow-hidden + inline-block zorgt dat de child niet
          // buiten de regel-baseline reikt. translate-Y(110%) zit in
          // de keyframe; transform-origin onderaan zodat het woord
          // "uit z'n shell" omhoog komt.
          className="inline-block overflow-hidden align-bottom"
        >
          <span
            className="inline-block"
            style={{
              animation: `hero-word-up 0.85s cubic-bezier(0.22, 1, 0.36, 1) ${delay + i * wordStaggerMs}ms both`,
            }}
          >
            {w}
          </span>
          {/* Behoud spatie tussen woorden zonder dat hij meedoet aan
              de overflow-hidden (anders verdwijnt de spatie). */}
          {i < words.length - 1 && <span>{" "}</span>}
        </span>
      ))}
    </span>
  );
}

