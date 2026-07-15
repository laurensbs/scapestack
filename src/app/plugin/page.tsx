import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlugZap, ShieldCheck } from "lucide-react";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Check RuneLite",
  description: "Let RuneLite help Scapestack skip finished OSRS progress."
};

type SearchParams = Record<string, string | string[] | undefined>;

export interface PluginHeroAction {
  id: "verify" | "next";
  label: string;
  href: string;
  kind: "primary" | "secondary";
  usesNextHandoff?: boolean;
}

const SYNC_STEPS = [
  {
    title: "Install Scapestack Sync"
  },
  {
    title: "Enable plugin"
  },
  {
    title: "Sync now or sync-on-login"
  },
  {
    title: "Open one plan"
  }
];

const TROUBLESHOOTING = [
  "Use the same display name as RuneLite.",
  "Use Sync on login or press Sync now.",
  "Open your bank before syncing when you want item readiness."
];

const PLAYER_SYNC_CHOICES = [
  {
    label: "Required",
    title: "Press Sync now once",
    body: "Connects this RuneLite install to the RSN you are playing."
  },
  {
    label: "Recommended",
    title: "Turn on Sync on login",
    body: "Keeps the next trip current without another browser step."
  },
  {
    label: "Included",
    title: "Open bank once",
    body: "Lets RuneLite send item stacks for gear, supplies and diary checks."
  },
  {
    label: "Optional",
    title: "Refresh after quests",
    body: "Useful while questing so completed quests disappear from the next trip."
  }
];

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
      title: "Back to your trip",
      body: "Sync RuneLite, then reopen the plan so finished progress disappears.",
      cta: "Back to plan",
      href: `/next?${params.toString()}`
    };
  }

  if (from === "profile") {
    const profileParams = new URLSearchParams();
    profileParams.set("from", "plugin");
    if (bank === "none") profileParams.set("bank", "none");
    return {
      title: "Back to profile",
      body: "Sync RuneLite, then return with finished progress removed.",
      cta: "Return to profile",
      href: rsn ? `/u/${encodeURIComponent(rsn)}?${profileParams.toString()}` : `/?${profileParams.toString()}`
    };
  }

  params.set("from", "plugin");
  const title = pluginHandoffTitle(from);
  return {
    title: `Back to ${title}`,
    body: "Sync RuneLite, then return with stale progress removed.",
    cta: `Return to ${title}`,
    href: `/${from}?${params.toString()}`
  };
}

export function pluginHeroActions(): PluginHeroAction[] {
  return [
    {
      id: "verify",
      label: "Check RuneLite",
      href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
      kind: "primary"
    },
    {
      id: "next",
      label: "Open one plan",
      href: "/next?from=plugin&bank=none",
      kind: "secondary",
      usesNextHandoff: true
    }
  ];
}

export default function PluginPage() {
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 pb-[28rem] pt-12 sm:px-8 sm:pt-18">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
          <PlugZap className="size-3.5" />
          RuneLite memory
        </div>

        <div>
          <h1
            aria-label="Check RuneLite. Open a cleaner trip."
            className="max-w-4xl text-[clamp(42px,7vw,74px)] font-bold leading-[0.96] tracking-normal text-[var(--color-text)]"
          >
            Check RuneLite.
            <span className="block text-route-gradient">Open a cleaner trip.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-[1.55] text-[var(--color-text-dim)] sm:text-[18px]">
            Type your RSN. RuneLite remembers finished quests, diary tiers, clog slots, Slayer and bank items after you sync.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PluginTrustPill label="No login" />
            <PluginTrustPill label="Bank can be turned off" />
            <PluginTrustPill label="No screenshots" />
          </div>
          <div className="mt-5">
            <RuneliteOpenButton />
          </div>
        </div>

      </section>

      <PostSyncActionPanel />

      <PluginSyncChecker />

      <details className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-[var(--color-text)] marker:hidden">
          <span>Setup help</span>
          <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-text-muted)]">
            Show
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Normal setup
            </div>
            <p className="mt-1 text-[13px] font-semibold text-[var(--color-text)]">
              Install the plugin, sync once, then check the same RSN here.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              The plugin connects to Scapestack automatically; open your bank once when you want item checks included.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PLAYER_SYNC_CHOICES.map((choice) => (
              <div
                key={choice.title}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3"
              >
                <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  {choice.label}
                </div>
                <div className="mt-1 text-[13px] font-bold text-[var(--color-text)]">
                  {choice.title}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
                  {choice.body}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-2">
              <RuneliteOpenButton />
            </div>
            {SYNC_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px] font-bold text-[var(--color-text)]"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[11px] text-[var(--color-accent)]">
                  {index + 1}
                </span>
                <span>{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-[var(--color-text)] marker:hidden">
          <span>Privacy and fixes</span>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--color-good)]">
            <ShieldCheck className="size-3.5" />
            No credentials
          </span>
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoTile title="RuneLite adds" body="Skills, XP, quests, diaries, clog, Slayer and bank items after sync." />
          <InfoTile title="Never reads" body="RuneScape password, inventory, equipment, chat, screenshots or clicks." />
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">
            <h3 className="text-[13px] font-bold text-[var(--color-text)]">Nothing showing?</h3>
            <ul className="mt-2 grid gap-1.5 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              {TROUBLESHOOTING.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </main>
  );
}

function pluginHandoffTitle(from: string): string {
  if (from === "bank") return "bank setup";
  if (from === "goals") return "goals";
  if (from === "slayer") return "Slayer";
  if (from === "dps") return "boss setup";
  return "Scapestack";
}

function PostSyncActionPanel() {
  const actions = pluginHeroActions();
  const primaryAction = actions.find((action) => action.id === "verify") ?? actions[0];
  const nextAction = actions.find((action) => action.id === "next") ?? actions[1];

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            After Sync now
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)]">
            Open one plan that skips finished stuff.
          </h2>
          <div className="mt-3 grid gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            <ActionLine text="Press Sync now in RuneLite." />
            <ActionLine text="Open one plan that skips finished quests, diaries, clog slots and Slayer." />
            <ActionLine text="Open your bank before syncing when gear should change the trip." />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={primaryAction.href}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[12px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110"
          >
            {primaryAction.label}
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href={nextAction.href}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            {nextAction.label}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ActionLine({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-good)]" />
      <span>{text}</span>
    </div>
  );
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">
      <h3 className="text-[13px] font-bold text-[var(--color-text)]">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{body}</p>
    </article>
  );
}

function PluginTrustPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-1.5 text-[11.5px] font-bold text-[var(--color-good)]">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
