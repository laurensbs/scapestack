import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, Clock3, DatabaseZap, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { CopyCommand } from "@/components/copy-command";
import { PluginBankHandoffBanner } from "@/components/plugin-bank-handoff-banner";
import { PluginNextLink } from "@/components/plugin-next-link";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { cn } from "@/lib/utils";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";
import { copyLabelForDevStep, PLUGIN_DEV_STEPS } from "@/lib/plugin-install";
import { getPluginHubStatus, pluginHubMaintainerReviewGate, pluginHubReviewReadiness, PLUGIN_HUB_PR_NUMBER, type PluginHubMaintainerReviewGate, type PluginHubReviewReadiness, type PluginHubStatus, type PluginHubStatusTone } from "@/lib/plugin-hub-status";
import { buildPluginPrBodyReplacement, buildPluginPrBodyUpdateCommand, buildPluginReviewerHandoffCommand, buildPluginReviewerPacket, buildPluginReviewerReplyCommand } from "@/lib/plugin-review-packet";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import type { PluginReleaseDrift } from "@/lib/plugin-release-drift";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "RuneLite plugin",
  description: "Install and understand the Scapestack RuneLite sync plugin."
};

const SYNCED_SIGNALS = [
  "Quest completion",
  "Achievement Diary tiers",
  "Collection-log item IDs",
  "Slayer task, points, streak and blocks"
];

const TROUBLESHOOTING = [
  "No data on /next? Use the exact same RSN spelling the plugin claimed.",
  "403 sync? Enable “Force claim retry” once in the plugin config. If the RSN was claimed by another install token, use that original RuneLite install.",
  "Collection log looks sparse? Open the Collection Log categories in-game once; RuneLite only exposes loaded widget data.",
  "Slayer task missing? Make sure you are logged in and the task state is visible to RuneLite before syncing.",
  "No chat line after login? Enable “Auto-sync on login” and “Show chat feedback”, then relog and confirm the Sync URL is reachable."
];

const DATA_SENT = [
  "RSN used for the claim",
  "Plugin version and sync status",
  "Quest and diary completion",
  "Collection-log item IDs loaded by RuneLite",
  "Slayer task, points, streak and block-list state"
];

const DATA_NEVER_SENT = [
  "RuneScape password or account login",
  "bank, inventory, equipment or GE offers",
  "chat messages, friends list or private messages",
  "Mouse clicks, key presses or gameplay inputs",
  "Screenshots, client files or RuneLite config folders"
];

const PR_BODY_CORRECTIONS = [
  "Auto-sync on login defaults off.",
  "Sync on quest complete defaults off.",
  "No progress POST happens until the player opts in from RuneLite settings.",
  "The opt-in payload includes quest, diary, collection-log and Slayer task state.",
  "The raw install token is sent only as an Authorization bearer for claim/sync; Scapestack stores sha256(token).",
  "Bank, inventory, equipment, chat, screenshots, inputs, IP and machine fingerprint are not sent."
];

const REVIEW_FIX_FIRST = [
  "Update the GitHub PR body first: the live text still says auto-sync defaults on.",
  "Replace the token paragraph before review: raw token is transmitted only as Authorization bearer; only sha256(token) is stored.",
  "Replace the old capture list before review: the shipped opt-in payload now includes Slayer task, streak, points and block-list state.",
  "Then add the reviewer packet as a short maintainer reply so the posted data, opt-in defaults and web-app handoff are all visible without opening the app."
];

const REVIEW_COPY_FIXES: Record<string, string> = {
  "auto-sync defaults": "State: Auto-sync on login defaults off and no progress POST happens until the player opts in.",
  "token transport": "State: the raw install token is sent only as Authorization bearer; Scapestack stores sha256(token).",
  "POST timing": "State: sync POSTs only after opt-in, not automatically on every login by default.",
  "quest-complete opt-in gate": "State: Sync on quest complete defaults off and is gated behind Auto-sync on login.",
  "Slayer payload": "State: the opt-in payload includes Slayer task, streak, points and block-list state.",
  "bank/inventory/equipment exclusion": "State: bank, inventory, equipment, GE offers and wealth are never sent by the plugin."
};

type SearchParams = Record<string, string | string[] | undefined>;

export interface PluginHeroAction {
  id: "verify" | "review-fix" | "web-next" | "live-pr";
  label: string;
  href: string;
  kind: "primary" | "secondary";
  external?: boolean;
  usesNextHandoff?: boolean;
}

function firstSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export function pluginContextFromSearchParams(searchParams: SearchParams) {
  const from = firstSearchParam(searchParams, "from").toLowerCase();
  const rsn = firstSearchParam(searchParams, "rsn").slice(0, 12);
  const bank = firstSearchParam(searchParams, "bank").toLowerCase();
  if (!["next", "bank", "profile", "goals", "slayer", "dps"].includes(from)) return null;

  const params = new URLSearchParams();
  if (rsn) params.set("rsn", rsn);
  if (bank === "none") params.set("bank", "none");

  if (from === "next") {
    params.set("from", "plugin");
    return {
      title: "You came from /next to verify sync",
      body: "Run the sync checker on this page first. Return to /next only after it finds a verified payload for the same RSN.",
      cta: "Return to /next",
      href: `/next?${params.toString()}`
    };
  }

  if (from === "profile") {
    const profileParams = new URLSearchParams();
    profileParams.set("from", "plugin");
    if (bank === "none") profileParams.set("bank", "none");
    return {
      title: "You came from this profile",
      body: "Verify RuneLite sync for this RSN, then return to the player profile without losing account context.",
      cta: "Return to profile",
      href: rsn ? `/u/${encodeURIComponent(rsn)}?${profileParams.toString()}` : `/?${profileParams.toString()}`
    };
  }

  params.set("from", "plugin");
  return {
    title: `You came from /${from}`,
    body: "Keep the same RSN context while you verify RuneLite sync, then return to the tool you were using.",
    cta: `Return to /${from}`,
    href: `/${from}?${params.toString()}`
  };
}

function installSteps(status: PluginHubStatus) {
  return [
    {
      title: status.state === "merged"
        ? "Install from Plugin Hub"
        : status.state === "closed"
        ? "Use developer install"
        : "Plugin Hub review",
      body: status.state === "merged"
        ? "Open RuneLite Plugin Hub, search for “Scapestack Sync”, and install it like any other community plugin."
        : status.state === "closed"
        ? "The Plugin Hub PR is closed right now. Use the developer install path below while the upstream submission is restored."
        : "The Plugin Hub PR is still upstream. Use the developer install path below until RuneLite maintainers approve it."
    },
    {
      title: "Enable sync",
      body: "Open Scapestack Sync settings and opt into “Auto-sync on login”. If you are logged in, the first sync starts immediately."
    },
    {
      title: "Confirm claim",
      body: "The plugin creates one local install token, reads your current game-state, and claims your RSN on Scapestack."
    },
    {
      title: "Open /next",
      body: "Type the same OSRS name. After /next loads the verified payload, it labels quest, diary, collection-log and Slayer coverage as verified, partial or missing."
    }
  ];
}

function toneClasses(tone: PluginHubStatusTone): { pill: string; dot: string; card: string; text: string } {
  switch (tone) {
    case "good":
      return {
        pill: "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]",
        dot: "bg-[var(--color-good)]",
        card: "border-[var(--color-good)]/25 bg-[var(--color-good)]/10",
        text: "text-[var(--color-good)]"
      };
    case "warning":
      return {
        pill: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        dot: "bg-[var(--color-warning)]",
        card: "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10",
        text: "text-[var(--color-warning)]"
      };
    case "danger":
      return {
        pill: "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
        dot: "bg-[var(--color-danger)]",
        card: "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10",
        text: "text-[var(--color-danger)]"
      };
    default:
      return {
        pill: "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
        dot: "bg-[var(--color-accent)]",
        card: "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10",
        text: "text-[var(--color-accent)]"
      };
  }
}

function updatedLabel(iso: string | null): string {
  if (!iso) return "GitHub live status";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "GitHub live status";
  return `Updated ${date.toISOString().slice(0, 10)}`;
}

export function shouldShowReleaseHandoff(env = process.env.NODE_ENV): boolean {
  return env !== "production";
}

export function pluginHeroActions(
  readiness: PluginHubReviewReadiness,
  status: Pick<PluginHubStatus, "url">
): PluginHeroAction[] {
  if (readiness.playerInstallReady) {
    return [
      {
        id: "verify",
        label: "Verify sync payload",
        href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
        kind: "primary"
      },
      {
        id: "live-pr",
        label: "View live PR status",
        href: status.url,
        kind: "secondary",
        external: true
      }
    ];
  }

  if (readiness.state === "review-blocked") {
    return [
      {
        id: "review-fix",
        label: "Fix review handoff first",
        href: "#pr-body-fix",
        kind: "primary"
      },
      {
        id: "web-next",
        label: "Use web recommendations",
        href: "/next?from=plugin&bank=none",
        kind: "secondary",
        usesNextHandoff: true
      }
    ];
  }

  return [
    {
      id: "web-next",
      label: "Use web recommendations",
      href: "/next?from=plugin&bank=none",
      kind: "primary",
      usesNextHandoff: true
    },
    {
      id: "live-pr",
      label: "Track Plugin Hub review",
      href: status.url,
      kind: "secondary",
      external: true
    }
  ];
}

async function getReleaseDriftForPage(): Promise<PluginReleaseDrift | null> {
  if (!shouldShowReleaseHandoff()) return null;
  const { getLocalPluginReleaseDrift } = await import("@/lib/plugin-release-drift");
  return getLocalPluginReleaseDrift();
}

export default async function PluginPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const pluginContext = pluginContextFromSearchParams(resolvedSearchParams);
  const pluginHubStatus = await getPluginHubStatus();
  const reviewReadiness = pluginHubReviewReadiness(pluginHubStatus);
  const releaseDrift = await getReleaseDriftForPage();
  const statusTone = toneClasses(pluginHubStatus.tone);
  const steps = installSteps(pluginHubStatus);
  const reviewerPacket = buildPluginReviewerPacket(pluginHubStatus);
  const prBodyReplacement = buildPluginPrBodyReplacement(pluginHubStatus);
  const prBodyUpdateCommand = buildPluginPrBodyUpdateCommand();
  const reviewerReplyCommand = buildPluginReviewerReplyCommand();
  const reviewerHandoffCommand = buildPluginReviewerHandoffCommand();
  const heroActions = pluginHeroActions(reviewReadiness, pluginHubStatus);
  const maintainerReviewGate = pluginHubMaintainerReviewGate(pluginHubStatus);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 pt-16 sm:pt-24 pb-24">
      <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-start">
        <div className="space-y-8">
          <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold", statusTone.pill)}>
            <span className={cn("size-1.5 rounded-full animate-pulse", statusTone.dot)} aria-hidden="true" />
            {pluginHubStatus.label}
          </div>

          <div>
            <h1 className="text-[clamp(42px,7vw,78px)] font-bold leading-[0.95] tracking-[-0.04em] text-[var(--color-text)]">
              Verified account state,
              <span className="block text-gold-gradient">straight from RuneLite.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] sm:text-[19px] leading-[1.55] text-[var(--color-text-dim)]">
              Scapestack works without a plugin, but a verified RuneLite payload turns it into a real OSRS copilot:
              quest and diary coverage stops being inferred, collection-log checks are verified, and Slayer tasks
              can become tonight&apos;s actual next action.
            </p>
          </div>

          <div className="flex flex-wrap gap-3" aria-label="Plugin next actions">
            {heroActions.map((action) => (
              <HeroActionLink key={action.id} action={action} />
            ))}
          </div>
          <p className="max-w-xl text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            {reviewReadiness.playerInstallReady
              ? "Player path: install from RuneLite, opt in, then verify the payload before /next trusts account coverage."
              : reviewReadiness.state === "review-blocked"
                ? "Reviewer path first: fix the live PR handoff. Player path stays on bank-aware web recommendations until install readiness is green."
                : "Player path today: bank-aware web recommendations. Tester path stays below behind the local Gradle setup."}
          </p>
        </div>

        <aside className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className={cn("mb-5 rounded-xl border px-4 py-3", statusTone.card)}>
            <div className={cn("text-[11px] uppercase tracking-[0.18em] font-bold", statusTone.text)}>
              RuneLite GitHub status
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              {pluginHubStatus.detail}
            </p>
            {pluginHubStatus.checkSummary && (
              <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] leading-relaxed text-[var(--color-text)]">
                {pluginHubStatus.checkSummary}
              </p>
            )}
            {pluginHubStatus.reviewSummary && (
              <p className={cn(
                "mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed",
                pluginHubStatus.reviewSummary.includes("requested changes")
                  ? "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                  : pluginHubStatus.reviewSummary.includes("approval recorded")
                    ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                    : "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              )}>
                {pluginHubStatus.reviewSummary}
              </p>
            )}
            {pluginHubStatus.pinSummary && (
              <p className={cn(
                "mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed",
                pluginHubStatus.submittedCommit === pluginHubStatus.standaloneCommit
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                  : "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}>
                {pluginHubStatus.pinSummary}
              </p>
            )}
            {pluginHubStatus.reviewCopySummary && (
              <p className={cn(
                "mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed",
                pluginHubStatus.reviewCopySummary.startsWith("Live PR body still")
                  ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                  : "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
              )}>
                {pluginHubStatus.reviewCopySummary}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              <span>{updatedLabel(pluginHubStatus.updatedAt)}</span>
              {pluginHubStatus.reviewCount !== null && <span>· {pluginHubStatus.reviewCount} review{pluginHubStatus.reviewCount === 1 ? "" : "s"}</span>}
              {pluginHubStatus.submittedCommit && <span>· reviewing {pluginHubStatus.submittedCommit.slice(0, 7)}</span>}
              {pluginHubStatus.standaloneCommit && <span>· standalone {pluginHubStatus.standaloneCommit.slice(0, 7)}</span>}
              <a href={pluginHubStatus.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                PR #{PLUGIN_HUB_PR_NUMBER}
              </a>
            </div>
          </div>

          <PluginReviewReadinessCard readiness={reviewReadiness} />
          <MaintainerReviewGateCard gate={maintainerReviewGate} />

          {releaseDrift && releaseDrift.status !== "unavailable" && (
            <ReleaseHandoffCard drift={releaseDrift} />
          )}

          <PrBodyReplacementCard
            value={prBodyReplacement}
            updateCommand={prBodyUpdateCommand}
            handoffCommand={reviewerHandoffCommand}
          />
          {pluginHubStatus.reviewCopyIssues.length > 0 && (
            <ReviewCopyBlockerCard issues={pluginHubStatus.reviewCopyIssues} />
          )}
          <ReviewerPacketCard value={reviewerPacket} replyCommand={reviewerReplyCommand} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
                Sync package
              </div>
              <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
                Scapestack Sync
              </h2>
              <div className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
                Plugin version v{CURRENT_PLUGIN_VERSION}
                {pluginHubStatus.submittedCommit && (
                  <span className="block mt-0.5">
                    Plugin Hub reviews commit {pluginHubStatus.submittedCommit.slice(0, 7)}
                  </span>
                )}
              </div>
            </div>
            <div className="size-12 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              <Sparkles className="size-6" />
            </div>
          </div>

          <div className="mt-6 grid gap-2">
            {SYNCED_SIGNALS.map((signal) => (
              <div key={signal} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2.5 text-[13px] text-[var(--color-text)]">
                <CheckCircle2 className="size-4 text-[var(--color-good)] shrink-0" />
                {signal}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-good)]">
              Explicit opt-in
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              The plugin does not POST progress until you enable Auto-sync or quest-complete sync in RuneLite settings.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-good)]">
              No account login
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              The plugin sends game-state snapshots, not passwords, inventory automation, clicks, or gameplay inputs.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
              In-game confirmation
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              v{CURRENT_PLUGIN_VERSION} prints a RuneLite chat line when sync starts, succeeds, fails, or needs a fresh claim. Success includes the verified /next link for that RSN.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
              Claim recovery
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              If a sync gets rejected, toggle “Force claim retry” once. The plugin keeps the same local token and re-runs the safe claim step.
            </p>
          </div>
        </aside>
      </section>

      {pluginContext && (
        <PluginContextBanner
          context={pluginContext}
          pluginHubStatus={pluginHubStatus}
        />
      )}

      <PluginBankHandoffBanner />

      <section className="mt-16 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <article
            key={step.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5"
          >
            <div className="size-8 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--color-accent)]">
              {index + 1}
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-[var(--color-text)]">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
          </article>
        ))}
      </section>

      <PluginSyncChecker />

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-good)]">
              Data contract
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              Opt-in progress sync, not account access.
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
              OSRS players should not have to guess what a plugin sends. Scapestack Sync only posts the
              progress signals needed for recommendations after you opt in inside RuneLite.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--color-good)]">
            <ShieldCheck className="size-3.5" />
            No credentials
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <DataListCard
            tone="good"
            title="Sent after opt-in"
            items={DATA_SENT}
          />
          <DataListCard
            tone="warning"
            title="Never sent"
            items={DATA_NEVER_SENT}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 p-5 sm:p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Player install path
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            {reviewReadiness.playerInstallReady ? "Install from RuneLite, then opt in." : "Public Plugin Hub install is not live yet."}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            {reviewReadiness.playerInstallReady
              ? "Open RuneLite Plugin Hub, search “Scapestack Sync”, enable Auto-sync on login, then return to /next with the same RSN."
              : `${reviewReadiness.detail} For normal players, keep using Scapestack with Hiscores, bank paste and public trackers. The Gradle install below is for testers and developers only.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PluginNextLink className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--color-bg)] hover:brightness-110 transition-all">
              Use web recommendations <ArrowRight className="size-4" />
            </PluginNextLink>
            <a
              href={pluginHubStatus.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors"
            >
              Track PR #{PLUGIN_HUB_PR_NUMBER}
            </a>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-good)]">
            After sync
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            /next becomes account-aware instead of tracker-aware.
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              "No already-finished quest recommendations",
              "Diary gates use real tier completion",
              "Collection-log checks use loaded item IDs",
              "Slayer actions use current task state",
              "RuneLite chat hands you the verified /next URL"
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-good)]" />
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        id="developer-install"
        className="mt-6 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
              Developer / tester install
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              {pluginHubStatus.state === "merged" ? "Test or self-host the RuneLite loop" : "Test the full RuneLite loop today"}
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
              {pluginHubStatus.state === "merged"
                ? "Plugin Hub install is the normal player path. Keep these commands for local development, self-hosting, or testing sync changes before release."
                : "While Plugin Hub review is pending, this side-load path is only for testers who are comfortable running the local web app and RuneLite from Gradle."}
            </p>
          </div>
          <a
            href={pluginHubStatus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors"
          >
            PR #{PLUGIN_HUB_PR_NUMBER} <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {PLUGIN_DEV_STEPS.map((step) => (
            <article key={step.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 p-4">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center text-[11px] font-bold text-[var(--color-accent)]">
                  {step.label}
                </span>
                <h3 className="text-[13px] font-bold text-[var(--color-text)]">{step.title}</h3>
              </div>
              <CopyCommand value={step.code} label={copyLabelForDevStep(step)} />
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid md:grid-cols-2 gap-4">
        <InfoCard
          icon={<ShieldCheck className="size-5" />}
          title="First-claim security"
          body="Each RuneLite install gets a local token. The first successful claim binds that token to the RSN, so later syncs must match the same install."
        />
        <InfoCard
          icon={<DatabaseZap className="size-5" />}
          title="Why it matters"
          body="Hiscores tell us levels and KC. The plugin tells us what your account has actually completed, so /next can stop recommending already-done quests or irrelevant Slayer actions."
        />
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
          Sync troubleshooting
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-2">
          {TROUBLESHOOTING.map((tip) => (
            <div key={tip} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              {tip}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            {reviewReadiness.playerInstallReady ? "Plugin Hub ready" : "While review is pending"}
          </div>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            {reviewReadiness.playerInstallReady
              ? "The web app now has the full loop: public trackers for fallback, bank paste for gear context, and verified RuneLite Plugin Hub payloads for coverage labels."
              : "The web app still works today with Hiscores, bank paste, TempleOSRS, WOM and collectionlog.net. When the plugin lands, this page becomes the install flow instead of sending players to GitHub."}
          </p>
        </div>
        <PluginNextLink
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/40 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-bg)]/70 transition-colors"
        >
          See recommendations <Wand2 className="size-4" />
        </PluginNextLink>
      </section>
    </main>
  );
}

function HeroActionLink({ action }: { action: PluginHeroAction }) {
  const className = action.kind === "primary"
    ? "inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--color-bg)] hover:brightness-110 transition-all"
    : "inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors";

  if (action.usesNextHandoff) {
    return (
      <PluginNextLink className={className}>
        {action.label} <ArrowRight className="size-4" />
      </PluginNextLink>
    );
  }

  return (
    <a
      href={action.href}
      target={action.external ? "_blank" : undefined}
      rel={action.external ? "noopener noreferrer" : undefined}
      className={className}
    >
      {action.label} {action.external ? <Clock3 className="size-4" /> : <ArrowRight className="size-4" />}
    </a>
  );
}

function ReviewCopyBlockerCard({ issues }: { issues: string[] }) {
  return (
    <div className="mb-5 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
        PR body blocking review
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        Even when the submitted commit is correct, reviewers still see stale submission text. Fix these before asking for another review pass.
      </p>
      <ul className="mt-3 grid gap-1.5 text-[12px] leading-relaxed text-[var(--color-warning)]">
        {issues.map((issue) => (
          <li key={issue} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{issue}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
          Exact replacement intent
        </div>
        <ul className="mt-2 grid gap-1.5">
          {issues.map((issue) => (
            <li key={issue} className="text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-warning)]">{issue}</span>
              <span className="text-[var(--color-text-muted)]"> — </span>
              {REVIEW_COPY_FIXES[issue] ?? "Replace with the canonical PR body generated by Scapestack."}
            </li>
          ))}
        </ul>
      </div>
      <code className="mt-3 block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 px-3 py-2 font-mono text-[11px] text-[var(--color-text)]">
        npm run --silent plugin:pr-body -- --offline
      </code>
    </div>
  );
}

function PluginReviewReadinessCard({ readiness }: { readiness: PluginHubReviewReadiness }) {
  const toneClass = readiness.tone === "good"
    ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
    : readiness.tone === "danger"
      ? "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
      : readiness.tone === "warning"
        ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
        : "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";

  return (
    <div id="review-readiness" className={cn("mb-5 rounded-xl border p-4", toneClass)}>
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold">
        Plugin Hub install readiness
      </div>
      <h3 className="mt-1 text-[14px] font-bold text-[var(--color-text)]">
        {readiness.label}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {readiness.detail}
      </p>
      {!readiness.playerInstallReady && (
        <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-warning)]">
          Normal players should stay on web recommendations until this card says Plugin Hub install can be advertised.
        </p>
      )}
      {readiness.blockers.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-[12px] leading-relaxed">
          {readiness.blockers.map((blocker) => (
            <li key={blocker} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{blocker}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MaintainerReviewGateCard({ gate }: { gate: PluginHubMaintainerReviewGate }) {
  const toneClass = gate.tone === "good"
    ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
    : gate.tone === "danger"
      ? "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
      : gate.tone === "warning"
        ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
        : "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";

  return (
    <div className={cn("mb-5 rounded-xl border px-4 py-3", toneClass)}>
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold">
        Maintainer review gate
      </div>
      <h3 className="mt-1 text-[14px] font-bold text-[var(--color-text)]">
        {gate.title}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {gate.body}
      </p>
      <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-text)]">
        {gate.nextAction}
      </p>
    </div>
  );
}

function ReviewerPacketCard({ value, replyCommand }: { value: string; replyCommand: string }) {
  return (
    <div className="mb-5 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
        RuneLite reviewer packet
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        Copy this into the Plugin Hub PR or a maintainer reply after extraction. It keeps the review focused on opt-in defaults, posted data, game integrity, background-thread HTTP and the web-app merge path.
      </p>
      <p className="mt-2 rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-warning)]">
        Replace stale PR-body copy before re-review. GitHub currently needs the consent/token wording aligned with the shipped plugin.
      </p>
      <ul className="mt-2 space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/25 px-3 py-2">
        {PR_BODY_CORRECTIONS.map((correction) => (
          <li key={correction} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-good)]" />
            <span>{correction}</span>
          </li>
        ))}
      </ul>
      <CopyCommand value={value} label="Copy reviewer packet" />
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
          Maintainer reply handoff
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          After the PR body is replaced, add this packet as a short PR comment so maintainers can review consent, payload, game integrity and web-app handoff without opening Scapestack.
        </p>
        <CopyCommand value={replyCommand} label="Copy reviewer reply command" />
      </div>
    </div>
  );
}

function PrBodyReplacementCard({
  value,
  updateCommand,
  handoffCommand
}: {
  value: string;
  updateCommand: string;
  handoffCommand: string;
}) {
  return (
    <div id="pr-body-fix" className="mb-5 scroll-mt-24 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
        PR body replacement
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        The live GitHub PR body still describes older defaults. Use this as the canonical replacement before requesting another maintainer pass.
      </p>
      <div className="mt-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
          Review fix first
        </div>
        <ol className="mt-2 space-y-1.5">
          {REVIEW_FIX_FIRST.map((item) => (
            <li key={item} className="text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
              {item}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-2 rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-warning)]">
        This version states opt-in defaults, Authorization bearer token behavior, read-only game integrity, background-thread HTTP, and the bankless web-app handoff.
      </div>
      <CopyCommand value={value} label="Copy PR body replacement" />
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
          GitHub auth prerequisite
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          The handoff commands need an authenticated GitHub CLI session with permission to edit the RuneLite Plugin Hub PR. Run this first if `gh auth status` is expired or points at the wrong account.
        </p>
        <CopyCommand value="gh auth login -h github.com" label="Copy GitHub auth login" />
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
          PR body only
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          Writes the live-status replacement body to `/tmp`, then edits RuneLite Plugin Hub PR #{PLUGIN_HUB_PR_NUMBER} via GitHub CLI. Run it only from an authenticated GitHub checkout with permission to edit the PR.
        </p>
        <CopyCommand value={updateCommand} label="Copy PR update command" />
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
          Full reviewer handoff
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          Preferred path after extraction: generate the canonical PR body and reviewer packet, edit PR #{PLUGIN_HUB_PR_NUMBER}, then add the maintainer comment in one command. This removes the stale body copy and makes the opt-in/web-app merge contract visible in GitHub.
        </p>
        <CopyCommand value={handoffCommand} label="Copy full handoff command" />
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-bg)]/35 px-3 py-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
          Final live gate
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          After editing the PR body and adding the reviewer reply, run the live gate. Do not present Plugin Hub install as ready until it prints `Live Plugin Hub release check passed`.
        </p>
        <CopyCommand value="npm run plugin:release-check:live" label="Copy final live gate" />
      </div>
    </div>
  );
}

function ReleaseHandoffCard({ drift }: { drift: PluginReleaseDrift }) {
  const dirty = drift.status === "dirty";

  return (
    <div className={cn(
      "mb-5 rounded-xl border px-4 py-3",
      dirty
        ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10"
        : "border-[var(--color-good)]/25 bg-[var(--color-good)]/10"
    )}>
      <div className={cn(
        "text-[11px] uppercase tracking-[0.18em] font-bold",
        dirty ? "text-[var(--color-warning)]" : "text-[var(--color-good)]"
      )}>
        Local release handoff
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {dirty
          ? `${drift.count} local release-impact path${drift.count === 1 ? "" : "s"} are not visible to RuneLite reviewers until the standalone repo is updated and the Plugin Hub pin is moved.`
          : "No local release-impact changes detected. The standalone Plugin Hub handoff is clean from this checkout."}
      </p>
      {dirty && (
        <>
          <div className="mt-2 rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-warning)]">
            Review risk: the live PR can be green while reviewers still inspect the old pinned standalone commit. Run the plan, extract, push, then confirm the live pin matches the standalone head.
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {drift.groups.map((group) => (
              <span
                key={group.label}
                className="rounded-full border border-[var(--color-warning)]/25 bg-[var(--color-bg)]/35 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-warning)]"
              >
                {group.label}: {group.count}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {drift.samplePaths.map((change) => (
              <div key={`${change.status}-${change.path}`} className="truncate rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1 text-[11px] text-[var(--color-text-muted)]">
                {change.status} {change.path}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <CopyCommand value="npm run plugin:release-plan" label="Copy release plan command" />
            <CopyCommand value="npm run plugin:release-check:live" label="Copy live pin check" />
          </div>
        </>
      )}
    </div>
  );
}

function PluginContextBanner({
  context,
  pluginHubStatus
}: {
  context: NonNullable<ReturnType<typeof pluginContextFromSearchParams>>;
  pluginHubStatus: PluginHubStatus;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            {context.title}
          </div>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            {context.body}
          </p>
          {pluginHubStatus.state !== "merged" && (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-warning)]">
              Plugin Hub review is still pending; normal players should keep using Hiscores and bank paste while testers use the developer path below.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <a
            href={`#${PLUGIN_VERIFY_SYNC_HASH}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110"
          >
            Verify payload <ArrowRight className="size-4" />
          </a>
          <a
            href={context.href}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/40 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-bg)]/70"
          >
            {context.cta} <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function DataListCard({ tone, title, items }: { tone: "good" | "warning"; title: string; items: string[] }) {
  const toneClass = tone === "good" ? "text-[var(--color-good)]" : "text-[var(--color-warning)]";
  const borderClass = tone === "good" ? "border-[var(--color-good)]/20" : "border-[var(--color-warning)]/20";
  const bgClass = tone === "good" ? "bg-[var(--color-good)]/8" : "bg-[var(--color-warning)]/8";

  return (
    <article className={cn("rounded-xl border p-4", borderClass, bgClass)}>
      <h3 className={cn("text-[12px] uppercase tracking-[0.16em] font-bold", toneClass)}>
        {title}
      </h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            <CheckCircle2 className={cn("mt-0.5 size-3.5 shrink-0", toneClass)} />
            {item}
          </div>
        ))}
      </div>
    </article>
  );
}

function InfoCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5">
      <div className="text-[var(--color-accent)]">{icon}</div>
      <h3 className="mt-3 text-[15px] font-bold text-[var(--color-text)]">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">{body}</p>
    </article>
  );
}
