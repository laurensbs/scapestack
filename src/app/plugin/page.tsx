import type { Metadata } from "next";
import { CheckCircle2, PlugZap, ShieldCheck } from "lucide-react";
import { CopyCommand } from "@/components/copy-command";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Scapestack Sync",
  description: "Check RuneLite for one cleaner OSRS plan."
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
    title: "Use the Scapestack link"
  },
  {
    title: "Sync from RuneLite"
  },
  {
    title: "Check the same RSN"
  }
];

const TROUBLESHOOTING = [
  "Sync URL: https://www.scapestack.org/api/sync",
  "Use the same display name as RuneLite.",
  "Use Auto-sync on login or press Sync now."
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
      title: "From /next",
      body: "Check RuneLite, then return to your plan.",
      cta: "Back to plan",
      href: `/next?${params.toString()}`
    };
  }

  if (from === "profile") {
    const profileParams = new URLSearchParams();
    profileParams.set("from", "plugin");
    if (bank === "none") profileParams.set("bank", "none");
    return {
      title: "From profile",
      body: "Check RuneLite, then return.",
      cta: "Return to profile",
      href: rsn ? `/u/${encodeURIComponent(rsn)}?${profileParams.toString()}` : `/?${profileParams.toString()}`
    };
  }

  params.set("from", "plugin");
  return {
    title: `From /${from}`,
    body: "Check RuneLite, then return.",
    cta: `Return to /${from}`,
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
          RuneLite Sync
        </div>

        <div>
          <h1
            aria-label="Check RuneLite. Skip done stuff."
            className="max-w-4xl text-[clamp(42px,7vw,74px)] font-bold leading-[0.96] tracking-tight text-[var(--color-text)]"
          >
            Check RuneLite.
            <span className="block text-gold-gradient">Skip done stuff.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-[1.55] text-[var(--color-text-dim)] sm:text-[18px]">
            Type your RSN. If RuneLite shows up, Scapestack stops sending you to quests, diary steps, clog slots and Slayer calls you already handled.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PluginTrustPill label="No login" />
            <PluginTrustPill label="No bank" />
            <PluginTrustPill label="No screenshots" />
          </div>
        </div>

      </section>

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
              Scapestack link
            </div>
            <p className="mt-1 break-all text-[13px] font-semibold text-[var(--color-text)]">
              {PUBLIC_SYNC_URL}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              This must be the scapestack.org link.
            </p>
            <div className="mt-3">
              <CopyCommand value={PUBLIC_SYNC_URL} label="Copy sync URL" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
          <InfoTile title="RuneLite adds" body="Quests, diaries, clog and Slayer, only after you turn on Scapestack Sync." />
          <InfoTile title="Never reads" body="RuneScape password, bank, inventory, chat or screenshots." />
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
