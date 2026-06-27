import { ArrowRight, CheckCircle2, Clock3, RotateCcw, Target } from "lucide-react";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";

export const revalidate = 300;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <section className="relative">
        <div className="grid min-h-[calc(100vh-6rem)] items-center gap-10 lg:grid-cols-[0.9fr_0.82fr] lg:gap-20 xl:gap-28">
          <div className="space-y-6">
            <h1 className="font-bold leading-[0.97] tracking-[-0.025em] text-[clamp(42px,6.2vw,72px)]">
              <RevealLine
                text="Stop bankstanding."
                delay={100}
                wordStaggerMs={70}
                className="block text-[var(--color-text)]"
              />
              <RevealLine
                text="One clear OSRS plan."
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
              Type your OSRS name. Get one thing to do now, two backups and a clean stop point.
            </p>

            <div
              style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.95s both" }}
            >
              <HeroIntake />
            </div>
          </div>

          <div
            className="relative mt-8 lg:mt-0"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
          >
            <HeroProductPreview />
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-[var(--color-border)] pt-10">
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
                Saved a trip?
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                Scapestack is free, no ads, no account. Coffee keeps the tools online.
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
        {/* Bottom tagline removed — the global Scapestack footer in
            app/layout.tsx sits below the BMC block and provides the page's
            final outro. Having a second tagline strip here made the global
            footer disappear from sight. */}
      </footer>
    </main>
  );
}

function HeroProductPreview() {
  return (
    <aside
      aria-label="Live anti-bankstanding plan preview"
      className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(230,165,47,0.16),transparent_34%),linear-gradient(145deg,var(--color-panel),var(--color-bg-2))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.36)] sm:p-5"
    >
      <div
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/70 to-transparent"
        aria-hidden="true"
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/58 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10">
            <ItemSprite id={28307} alt="Vardorvis" className="scale-125" />
          </span>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-good)]">
              <Target className="size-3.5" aria-hidden="true" />
              Anti-bankstanding plan
            </div>
            <h2 className="mt-3 text-[24px] font-black leading-tight tracking-tight text-[var(--color-text)]">
              Push Vardorvis to 50 KC
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <PreviewRow
            icon={<Target className="size-4" />}
            label="Goal"
            value="Get enough KC to know if the grind fits."
          />
          <PreviewRow
            icon={<Clock3 className="size-4" />}
            label="Time"
            value="45-90 min"
          />
          <PreviewRow
            icon={<ArrowRight className="size-4" />}
            label="First step"
            value="Check gear, then do one short trip."
          />
          <PreviewRow
            icon={<RotateCcw className="size-4" />}
            label="Backup"
            value="Push Farming to 99 if you want chill progress."
          />
          <PreviewRow
            icon={<CheckCircle2 className="size-4" />}
            label="Stop point"
            value="Stop after one trip or 10 KC."
          />
          <div className="mt-2 rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-2">
            <div className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--color-good)]">
              <CheckCircle2 className="size-4" />
              Done: mark it finished and get the next plan.
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreviewRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[var(--color-accent)]" aria-hidden="true">{icon}</span>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {label}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--color-text)]">
            {value}
          </div>
        </div>
      </div>
    </div>
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
