import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers, PlugZap, Sparkles, Target } from "lucide-react";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";
import { ScapestackCommandSystem } from "@/components/scapestack-command-system";
import { HOME_PRODUCT_FLOW, type HomeFlowStep } from "@/lib/home-flow";
import { cn } from "@/lib/utils";

export const revalidate = 300;

function flowAccent(step: HomeFlowStep): string {
  switch (step.accent) {
    case "bank":
      return "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
    case "sync":
      return "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]";
    default:
      return "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  }
}

function FlowIcon({ accent }: { accent: HomeFlowStep["accent"] }) {
  if (accent === "bank") return <Layers className="size-4" />;
  if (accent === "sync") return <PlugZap className="size-4" />;
  return <Sparkles className="size-4" />;
}

const HERO_LOOP_STEPS = ["RSN", "Best move", "Backups"] as const;

const HERO_PREVIEW_ITEMS = [
  { id: 28307, name: "Vardorvis chase" },
  { id: 4151, name: "Abyssal whip" },
  { id: 2434, name: "Prayer potion" },
  { id: 11832, name: "Bandos chestplate" }
] as const;

const HERO_ACTION_CHOICES = [
  { label: "Boss KC", body: "Find a target where your stats and gear line up.", href: "/dps" },
  { label: "Slayer task", body: "Route it: kill, skip, extend, barrage or cannon.", href: "/slayer" },
  { label: "Closest unlock", body: "Push the diary, quest, cape or raids prep step that is actually near.", href: "/goals" }
] as const;

const HERO_ACCOUNT_LEVERS = ["Time", "Mood", "Gear", "Supplies", "KC", "Quests", "Diaries", "Slayer", "GP"] as const;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 pt-16 sm:pt-24 pb-24">
      {/* ── HERO ─────────────────────────────────────────────────────────
          Apple-style asymmetric split. Tekst + input links met heel veel
          ademruimte; boss showcase rechts als productfoto. Geen
          background-gradient — strakke zwarte canvas zodat de content
          domineert. */}
      <section className="relative mb-16 sm:mb-24">
        <div className="grid min-h-[calc(100vh-7rem)] items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-24 xl:gap-32">
          {/* Linkerkolom — leading content. Apple-style reveals:
              - Titel: word-by-word lift+blur, 60ms stagger per woord
              - Subhead: mask-reveal (clip-path animatie)
              - Intake: scale-in + fade
              Alle ease cubic-bezier(0.22,1,0.36,1) — Apple's "ease-out
              expressive" curve. */}
          <div className="space-y-6">
            <h1 className="font-bold leading-[0.97] tracking-[-0.025em] text-[clamp(42px,6.2vw,72px)]">
              <RevealLine
                text="What should I do next?"
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
              Enter your OSRS name. Get one best move, why it matters, how long it takes
              and what to do first. Add bank or sync later.
            </p>

            <div
              style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.95s both" }}
            >
              <HeroIntake />
            </div>
          </div>

          {/* Rechterkolom — geen abstracte SaaS mockup maar een live
              Scapestack beslis-preview: data in, item IDs zichtbaar, actie
              uit. */}
          <div
            className="relative mt-8 lg:mt-0"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
          >
            <HeroProductPreview />
          </div>
        </div>
      </section>

      <ScapestackCommandSystem />

      {/* 'More tools' card grid removed — the homepage is /next, and the
          tool-card sprites + 3-2 grid asymmetry weren't reading as
          premium. Header + sidebar still surface Bank/DPS/Goals/Slayer/Sync as
          direct nav; cached /tool URLs work unchanged. */}

      <section className="mb-20 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
              How it works
            </div>
            <h2 className="max-w-2xl text-[26px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[34px]">
              One plan first. More context later.
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-text-dim)]">
              Start with public stats. Add bank or RuneLite only when gear, quests or Slayer would change the answer.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {HOME_PRODUCT_FLOW.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              data-testid="home-flow-step-card"
              aria-label={`${step.cta}: ${step.title}`}
              className="group/flow-card block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-bg)]/55 focus:outline-none focus-visible:border-[var(--color-accent)]/60 focus-visible:shadow-[0_0_0_3px_rgba(230,165,47,0.14)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className={cn("inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold", flowAccent(step))}>
                  <FlowIcon accent={step.accent} />
                  {step.label}
                </div>
                <CheckCircle2 className="size-4 text-[var(--color-good)]" />
              </div>
              <h3 className="mt-4 text-[16px] font-bold tracking-tight text-[var(--color-text)]">{step.title}</h3>
              <p className="mt-2 min-h-[58px] text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-accent)] transition-all group-hover/flow-card:gap-2">
                {step.cta}
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

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
      aria-label="Live Scapestack product preview"
      className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(230,165,47,0.18),transparent_34%),linear-gradient(145deg,var(--color-panel),var(--color-bg-2))] p-4 shadow-[0_34px_110px_rgba(0,0,0,0.38)] sm:p-5"
    >
      <div
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/70 to-transparent"
        aria-hidden="true"
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/58 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
          {HERO_LOOP_STEPS.map((step, index) => (
            <span key={step} className="inline-flex items-center gap-2">
              <span className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-1 text-[var(--color-accent)]">
                {step}
              </span>
              {index < HERO_LOOP_STEPS.length - 1 ? (
                <ArrowRight className="size-3 text-[var(--color-text-muted)]" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-good)]">
                <Target className="size-3.5" aria-hidden="true" />
                Next action
              </div>
              <h2 className="mt-3 text-[22px] font-black leading-tight tracking-tight text-[var(--color-text)]">
                Push Vardorvis to 50 KC
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                A clean 50 KC test: learn the setup, bank loot, then decide whether to keep going.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--color-border)] bg-black/25 p-2">
              {HERO_PREVIEW_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="grid size-11 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80"
                  title={item.name}
                >
                  <ItemSprite id={item.id} alt={item.name} className="scale-125" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link
              href="/dps?boss=vardorvis"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              Start
            </Link>
            <Link
              href="/dps?boss=vardorvis"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              Setup
            </Link>
            <Link
              href="/next?bank=none"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              Backup
            </Link>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-2 text-[11.5px] font-bold text-[var(--color-good)]"
            >
              Done
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
              Other good routes
            </div>
            <div className="mt-3 grid gap-2">
              {HERO_ACTION_CHOICES.map((choice) => (
                <Link
                  key={choice.label}
                  href={choice.href}
                  className="group/choice rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-3 py-2 transition-colors hover:border-[var(--color-accent)]/45"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-[var(--color-text)]">{choice.label}</span>
                    <ArrowRight className="size-3.5 text-[var(--color-text-muted)] transition-transform group-hover/choice:translate-x-0.5 group-hover/choice:text-[var(--color-accent)]" />
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{choice.body}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
              Plan around
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {HERO_ACCOUNT_LEVERS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-secondary)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              RSN is enough to start. Bank and RuneLite help only when they change the pick.
            </p>
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
