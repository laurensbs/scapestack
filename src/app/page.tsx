import Link from "next/link";
import { ArrowRight, CheckCircle2, EyeOff, Layers, PlugZap, ShieldCheck, Sparkles, Target } from "lucide-react";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { CopyCommand } from "@/components/copy-command";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";
import { ScapestackCommandSystem } from "@/components/scapestack-command-system";
import { BRAND_SECONDARY_TAGLINE, BRAND_TAGLINE } from "@/lib/brand";
import { HOME_SYNC_COPY, homePluginReadinessPill, homeProductFlowForPluginReadiness, homeSyncServicePill, type HomeFlowStep, type HomePluginReadinessPill } from "@/lib/home-flow";
import { getPluginHubStatus, pluginHubReviewReadiness, type PluginHubStatusTone } from "@/lib/plugin-hub-status";
import { getSyncServiceStatus } from "@/lib/sync-service-readiness";
import { cn } from "@/lib/utils";

export const revalidate = 300;

function pluginStatusClasses(tone: PluginHubStatusTone): string {
  switch (tone) {
    case "good":
      return "text-[var(--color-good)] hover:text-[var(--color-good)]";
    case "warning":
      return "text-[var(--color-warning)] hover:text-[var(--color-warning)]";
    case "danger":
      return "text-[var(--color-danger)] hover:text-[var(--color-danger)]";
    default:
      return "text-[var(--color-text-dim)] hover:text-[var(--color-accent)]";
  }
}

function pluginDotClass(tone: PluginHubStatusTone): string {
  switch (tone) {
    case "good":
      return "bg-[var(--color-good)]";
    case "warning":
      return "bg-[var(--color-warning)]";
    case "danger":
      return "bg-[var(--color-danger)]";
    default:
      return "bg-[var(--color-accent)]";
  }
}

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

const HERO_LOOP_STEPS = ["Bank", "Next action", "RuneLite sync"] as const;

const HERO_PREVIEW_ITEMS = [
  { id: 28307, name: "Vardorvis chase" },
  { id: 4151, name: "Abyssal whip" },
  { id: 2434, name: "Prayer potion" },
  { id: 11832, name: "Bandos chestplate" }
] as const;

const HERO_READINESS_SIGNALS = [
  { label: "Bank", body: "Items, quantities, gear and GP value." },
  { label: "RSN", body: "Public Hiscores, combat level and boss KC." },
  { label: "RuneLite sync", body: "Opt-in quests, diaries, collection log and Slayer." }
] as const;

const HERO_NEVER_READS = ["chat", "passwords", "clicks", "screenshots", "login data"] as const;

export default async function HomePage() {
  const [pluginHubStatus, syncServiceStatus] = await Promise.all([
    getPluginHubStatus(),
    getSyncServiceStatus()
  ]);
  const reviewReadiness = pluginHubReviewReadiness(pluginHubStatus);
  const pluginReadinessPill = homePluginReadinessPill(reviewReadiness);
  const syncServicePill = homeSyncServicePill(syncServiceStatus);
  const productFlow = homeProductFlowForPluginReadiness(reviewReadiness);

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
          <div className="space-y-8">
            <h1 className="font-bold leading-[0.95] tracking-[-0.025em] text-[clamp(44px,8vw,88px)]">
              <RevealLine
                text={BRAND_TAGLINE}
                delay={100}
                wordStaggerMs={70}
                className="block text-[var(--color-text)]"
              />
              <RevealLine
                text="Bank → next action → RuneLite sync."
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
              {BRAND_SECONDARY_TAGLINE} Paste bank context, type an RSN, or connect RuneLite
              sync. Scapestack turns that into one concrete route before you start bank standing.
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
              One Scapestack loop
            </div>
            <h2 className="max-w-2xl text-[26px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[34px]">
              Start with your bank. Add RuneLite sync. End with a plan that says what data it used.
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-text-dim)]">
              Bank Memory is best when you want quantities and GP value; Bank Tags still gives exact layout.
              Verified RuneLite sync labels quest, diary, collection-log and Slayer coverage as verified, partial or missing.
              The plugin does not send bank data.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Link
              href={pluginReadinessPill.href}
              className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors", pluginStatusClasses(pluginReadinessPill.tone))}
              title={pluginReadinessPill.detail}
            >
              <span className={cn("size-1.5 rounded-full animate-pulse", pluginDotClass(pluginReadinessPill.tone))} aria-hidden="true" />
              {pluginReadinessPill.label}
            </Link>
            <Link
              href={syncServicePill.href}
              className={cn(
                "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                syncServicePill.tone === "good" && "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]",
                syncServicePill.tone === "warning" && "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
                syncServicePill.tone === "danger" && "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
              )}
              title={syncServicePill.detail}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  syncServicePill.tone === "good" && "bg-[var(--color-good)]",
                  syncServicePill.tone === "warning" && "bg-[var(--color-warning)]",
                  syncServicePill.tone === "danger" && "bg-[var(--color-danger)]"
                )}
                aria-hidden="true"
              />
              <span className="truncate">{syncServicePill.label}</span>
            </Link>
            <ScapestackSyncReadinessCard readiness={pluginReadinessPill} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {productFlow.map((step) => (
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

        <div className="mt-4 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[var(--color-text)]">Developing the RuneLite loop locally?</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{HOME_SYNC_COPY.helper}</p>
            </div>
            <div className="min-w-0 lg:w-[420px]">
              <CopyCommand value={HOME_SYNC_COPY.value} label={HOME_SYNC_COPY.label} />
            </div>
          </div>
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
                Bank has supplies, RSN has combat ready, RuneLite sync shows Desert Treasure II done.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--color-border)] bg-black/25 p-2">
              {HERO_PREVIEW_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="grid size-11 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80"
                  title={`${item.name} · item ID ${item.id}`}
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
              DPS route
            </Link>
            <Link
              href="https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=28307"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              Item ID 28307
            </Link>
            <Link
              href="https://oldschool.runescape.wiki/w/Vardorvis"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              Wiki
            </Link>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-2 text-[11.5px] font-bold text-[var(--color-good)]"
            >
              Mark done
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
              <ShieldCheck className="size-4 text-[var(--color-good)]" aria-hidden="true" />
              What Scapestack uses
            </div>
            <div className="mt-3 space-y-2">
              {HERO_READINESS_SIGNALS.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-3 py-2">
                  <div className="text-[12px] font-bold text-[var(--color-text)]">{signal.label}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{signal.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
              <EyeOff className="size-4 text-[var(--color-warning)]" aria-hidden="true" />
              What it never reads
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {HERO_NEVER_READS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-dim)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              RuneLite sync is opt-in account-state only. Bank paste stays browser-session scoped.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ScapestackSyncReadinessCard({ readiness }: { readiness: HomePluginReadinessPill }) {
  return (
    <div
      id="sync-readiness"
      aria-label="Scapestack Sync readiness"
      className="max-w-[360px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2.5 text-left"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
        <span className={cn("size-1.5 rounded-full", pluginDotClass(readiness.tone))} aria-hidden="true" />
        Scapestack Sync readiness
      </div>
      <div className="mt-1 text-[12.5px] font-bold text-[var(--color-text)]">{readiness.label}</div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">{readiness.detail}</p>
      <Link
        href={readiness.href}
        className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-accent)] hover:underline"
      >
        Check sync <ArrowRight className="size-3.5" />
      </Link>
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
