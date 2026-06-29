import { CheckCircle2, Target } from "lucide-react";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";

export const revalidate = 300;

const HERO_SESSION_SWITCHER = [
  {
    label: "Bossing",
    title: "Push Vardorvis to 50 KC",
    itemId: 28307,
    meta: "45-90 min",
    why: "Started KC. Clean stop point.",
    start: "Check kill setup, then do one trip."
  },
  {
    label: "AFK",
    title: "Run herbs + birdhouses",
    itemId: 9810,
    meta: "10 min loop",
    why: "Useful progress with low attention.",
    start: "Do herbs first, then reset houses."
  },
  {
    label: "Unlock",
    title: "Desert Diary - Hard",
    itemId: 13133,
    meta: "One task block",
    why: "Diary reward beats random skilling.",
    start: "Check the closest unfinished task."
  }
] as const;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-18 pt-10 sm:px-8 sm:pt-14">
      <section className="relative flex min-h-[calc(100vh-6rem)] items-center">
        <div className="mx-auto grid w-full items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
          <div className="space-y-5 text-center lg:text-left">
            <div
              className="eyebrow"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.02s both" }}
            >
              OSRS session board
            </div>
            <h1
              aria-label="Stop bankstanding. Pick the next trip."
              className="mx-auto max-w-[820px] text-[44px] font-semibold leading-[0.95] text-[var(--color-text)] sm:text-[62px] lg:mx-0 lg:text-[76px]"
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
              className="mx-auto max-w-[610px] text-[16px] leading-[1.6] text-[var(--color-text-secondary)] sm:text-[18px] lg:mx-0"
              style={{
                animation: "hero-mask-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.85s both",
                clipPath: "inset(0 0 100% 0)"
              }}
            >
              Type your OSRS name. Get one trip, two backups and a stop point before you open another Wiki tab.
            </p>

            <div
              className="mx-auto max-w-[720px] lg:mx-0"
              style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.95s both" }}
            >
              <HeroIntake />
            </div>
          </div>

          <div
            className="relative mx-auto w-full max-w-[440px] lg:mx-0"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
          >
            <HeroSessionSwitcher />
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-[var(--color-border)] pt-10">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_24px_70px_-48px_rgba(0,0,0,0.78)] animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(200, 154, 61,0.4), transparent)" }}
          />

          <div className="relative p-8 sm:p-10 grid sm:grid-cols-[1fr_auto] items-center gap-6">
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

function HeroSessionSwitcher() {
  const [primary, ...backups] = HERO_SESSION_SWITCHER;

  return (
    <aside
      aria-label="Live OSRS trip switcher"
      className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left shadow-[0_28px_90px_-64px_rgba(0,0,0,0.92)] sm:p-5"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 48% 24%, rgba(200,154,61,0.20), transparent 32%), radial-gradient(circle at 80% 82%, rgba(126,160,196,0.10), transparent 34%)"
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-good)]">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Live trip preview
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/38 px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-dim)]">
          {primary.meta}
        </span>
      </div>

      <div className="relative mt-5">
        <div className="mx-auto grid aspect-square max-w-[300px] place-items-center rounded-[32px] border border-[var(--color-accent)]/18 bg-[var(--color-bg)]/48 shadow-[inset_0_1px_0_rgba(233,221,197,0.06),0_24px_70px_-50px_rgba(200,154,61,0.65)]">
          <div className="grid size-[72%] place-items-center rounded-full border border-[var(--color-accent)]/24 bg-[var(--color-accent)]/8">
            <ItemSprite
              id={primary.itemId}
              alt=""
              size={164}
              className="scale-[1.08]"
              loading="eager"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/42 p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/22 bg-[var(--color-accent)]/8 px-2.5 py-1 text-[11px] font-bold text-[var(--color-accent)]">
            <Target className="size-3.5" aria-hidden="true" />
            Do this first
          </div>
          <h2 className="mt-2.5 text-[27px] font-semibold leading-tight text-[var(--color-text)]">
            {primary.title}
          </h2>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {primary.why}
          </p>
          <p className="mt-3 rounded-xl border border-[var(--color-accent)]/16 bg-[var(--color-accent)]/7 px-3 py-2 text-[12.5px] font-bold leading-snug text-[var(--color-text)]">
            Start: {primary.start}
          </p>
        </div>

        <div className="mt-3 grid gap-2">
          {backups.map((session) => (
            <div
              key={session.label}
              className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/34 px-3 py-2.5"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/75">
                <ItemSprite id={session.itemId} alt="" size={28} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  {session.label}
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-bold text-[var(--color-text)]">
                  {session.title}
                </span>
              </span>
              <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
                {session.meta}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-good)]/22 bg-[var(--color-good)]/8 px-3 py-2">
          <div className="flex items-start gap-2 text-[12.5px] font-bold leading-snug text-[var(--color-good)]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>RuneLite can quietly skip quests, diaries, clog slots and Slayer mistakes later.</span>
          </div>
        </div>
      </div>
    </aside>
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
