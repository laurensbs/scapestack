import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";

export const revalidate = 300;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-18">
      <section className="relative">
        <div className="grid min-h-[calc(100vh-6rem)] items-center gap-10 lg:grid-cols-[0.9fr_0.82fr] lg:gap-20 xl:gap-28">
          <div className="space-y-6">
            <h1
              aria-label="Stop bankstanding. One clear OSRS plan."
              className="text-[48px] font-semibold leading-[0.96] text-[var(--color-text)] sm:text-[64px] lg:text-[72px]"
            >
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
                className="block text-route-gradient"
                style={{
                  animation: "route-shimmer 7s linear 1.8s infinite",
                  backgroundSize: "200% 100%"
                }}
              />
            </h1>

            <p
              className="max-w-[520px] text-[17px] leading-[1.55] text-[var(--color-text-secondary)] sm:text-[19px]"
              style={{
                animation: "hero-mask-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.85s both",
                clipPath: "inset(0 0 100% 0)"
              }}
            >
              Type your OSRS name. Scapestack gives one best move, two backups and a clean stop point.
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
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_24px_70px_-48px_rgba(65,49,25,0.45)] animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(15, 118, 110,0.4), transparent)" }}
          />

          <div className="relative p-8 sm:p-10 grid sm:grid-cols-[1fr_auto] items-center gap-6">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-semibold text-[var(--color-text)] tracking-normal leading-tight">
                Saved a trip?
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                Scapestack is free, no ads, no account. Coffee keeps the tools online.
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

function HeroProductPreview() {
  return (
    <aside
      aria-label="Live anti-bankstanding plan preview"
      className="scapestack-plan-panel relative overflow-hidden p-4 sm:p-5"
    >
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-good)]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Screenshot-ready plan
          </div>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)]/55 px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-dim)]">
            45-90 min
          </span>
        </div>

        <div className="mt-4 flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[var(--color-accent)]/28 bg-[var(--color-accent)]/10 shadow-[0_12px_30px_-24px_rgba(15,118,110,0.56)]">
            <ItemSprite id={28307} alt="Vardorvis" className="scale-125" />
          </span>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-accent)]">
              <Target className="size-3.5" aria-hidden="true" />
              Do this first
            </div>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight text-[var(--color-text)]">
              Push Vardorvis to 50 KC
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              15 KC means the boss is already started. 50 KC is a clean stop point.
            </p>
          </div>
        </div>

        <dl className="scapestack-session-list mt-5">
          <PreviewLine label="Why" value="Your account has a real PvM thread, not a random boss suggestion." />
          <PreviewLine label="First step" value="Open DPS, lock setup, then do one short trip." />
          <PreviewLine label="Stop point" value="Stop after one trip or 10 KC. Re-run /next after." />
          <PreviewLine label="Bring" value="Best owned melee setup, teleports and supplies for a small block." />
        </dl>

        <div className="mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Backups
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <PreviewBackup label="AFK" title="Push Farming to 99" />
            <PreviewBackup label="Unlock" title="Desert Diary - Hard" />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-2">
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--color-good)]">
            <CheckCircle2 className="size-4" />
            RuneLite can skip quests, diaries, clog slots and Slayer mistakes later.
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreviewLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="text-[13px] font-semibold leading-snug text-[var(--color-text)]">
        {value}
      </dd>
    </div>
  );
}

function PreviewBackup({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[13px] font-bold text-[var(--color-text)]">
          {title}
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
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
