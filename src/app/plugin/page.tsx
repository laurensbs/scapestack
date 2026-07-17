import type { Metadata } from "next";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "RuneLite",
  description: "Keep Scapestack current with one RuneLite sync."
};

type SearchParams = Record<string, string | string[] | undefined>;

export interface PluginHeroAction {
  id: "verify" | "next";
  label: string;
  href: string;
  kind: "primary" | "secondary";
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
    <main className="relative z-10 mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8 sm:pt-16">
      <header>
        <p className="eyebrow text-[var(--color-accent)]">RuneLite connection</p>
        <h1 className="mt-2 max-w-2xl font-serif text-[42px] font-bold leading-[1.02] text-[var(--color-text)] sm:text-[58px]">
          Keep your next trip current.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] font-semibold leading-relaxed text-[var(--color-text-dim)] sm:text-[16px]">
          Scapestack checks your active account automatically. One scan keeps finished progress out and can bring your bank into the next plan.
        </p>
      </header>

      <PluginSyncChecker />

      <details className="group mt-5 border-y border-[var(--color-border)] py-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text-dim)] marker:hidden">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--color-accent)]" />
            What RuneLite shares
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 pt-3 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-muted)] sm:grid-cols-2">
          <p>Skills, XP, completed quests, diary tiers, clog items, Slayer and optional bank stacks.</p>
          <p>Sync on login is optional and off by default. Bank can be turned off at any time.</p>
          <p className="sm:col-span-2">No RuneScape password, chat, screenshots, clicks, inventory or equipped items.</p>
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
