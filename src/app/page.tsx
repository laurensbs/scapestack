import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroBossTripPreview } from "@/components/hero-boss-trip-preview";
import { HeroIntake } from "@/components/hero-intake";

export const revalidate = 300;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-18 pt-10 sm:px-8 sm:pt-14">
      <section className="relative flex min-h-[calc(100vh-6rem)] items-center">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-7 py-8 text-center">
          <div className="w-full space-y-5">
            <div
              className="eyebrow"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.02s both" }}
            >
              OSRS session board
            </div>
            <h1
              aria-label="Stop bankstanding. Pick the next trip."
              className="mx-auto max-w-[860px] pb-1 text-[44px] font-semibold leading-[1.06] text-[var(--color-text)] sm:text-[62px] sm:leading-[1.02] lg:text-[80px] lg:leading-[1.02]"
            >
              <RevealLine
                text="Stop bankstanding."
                delay={100}
                wordStaggerMs={70}
                className="block text-[var(--color-text)]"
              />
              <RevealLine
                text="Pick the next trip."
                delay={350}
                wordStaggerMs={80}
                className="block text-route-gradient"
                style={{
                  animation: "route-shimmer 7s linear 1.8s infinite",
                  backgroundSize: "200% 100%"
                }}
              />
            </h1>

            <p
              className="mx-auto max-w-[610px] text-[16px] leading-[1.6] text-[var(--color-text-secondary)] sm:text-[18px]"
              style={{
                animation: "hero-mask-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.85s both",
                clipPath: "inset(0 0 100% 0)"
              }}
            >
              Type your OSRS name. Get one trip, two backups and a stop point before you open another Wiki tab.
            </p>

            <div
              className="mx-auto max-w-[720px]"
              style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.95s both" }}
            >
              <HeroIntake />
            </div>
          </div>

          <div
            className="relative mx-auto w-full max-w-[560px]"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
          >
            <HeroBossTripPreview />
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-[var(--color-parchment-edge)]/50 pt-10">
        <div className="osrs-frame relative mx-auto max-w-3xl animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(200, 154, 61,0.4), transparent)" }}
          />

          <div className="osrs-body relative grid items-center gap-6 p-8 sm:grid-cols-[1fr_auto] sm:p-10">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-semibold text-[var(--color-text)] tracking-normal leading-tight">
                Help keep Scapestack running
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                Free, no ads, no account. Coffee keeps the tools online.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <BuyMeCoffee />
              <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                One-time · from €1 · takes 20 seconds
              </span>
            </div>
          </div>
        </div>
        {/* Bottom tagline removed — the global Scapestack footer in
            app/layout.tsx sits below the BMC block and provides the page's
            final outro. Having a second tagline strip here made the global
            footer disappear from sight. */}
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
          className="inline-block overflow-visible align-bottom"
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
