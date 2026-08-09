import type { Metadata } from "next";
import { DeleteAccountDataButton } from "@/components/delete-account-data-button";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { RecapNumber, ScrollRecap } from "@/components/rebrand/scroll-recap";
import { WeeklyRecapSettings } from "@/components/weekly-recap-settings";
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
      href: rsn ? `/p/${encodeURIComponent(rsn)}?${profileParams.toString()}` : `/?${profileParams.toString()}`
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
    <main className="scape-page scape-page--reading pb-28 pt-10 sm:px-8 sm:pt-16">
      <header className="mb-8 border-b border-[var(--color-border)] pb-6">
        <p className="eyebrow">RuneLite connection</p>
        <h1 className="mt-2 max-w-2xl font-serif text-[42px] font-bold leading-[1.02] text-[var(--color-text)] sm:text-[58px]">
          Keep your next trip current.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] font-semibold leading-relaxed text-[var(--color-text-dim)] sm:text-[16px]">
          Scapestack checks your active account automatically. One scan keeps finished progress out and can bring your bank into the next plan.
        </p>
      </header>

      <PluginSyncChecker />

      <section className="mt-8 border-y border-[var(--color-border-strong)] py-6" aria-labelledby="plugin-explanation-title">
        <h2 id="plugin-explanation-title" className="font-serif text-[28px] font-bold leading-tight text-[var(--color-text)]">
          How Scapestack and the plugin work together
        </h2>
        <dl className="mt-6 divide-y divide-[var(--color-border)]">
          <div className="py-4 first:pt-0">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">What Scapestack is</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Scapestack remembers what you are working toward and tells you the next step.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">What the plugin does</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              The plugin reads your account from RuneLite and sends it to Scapestack. That is how the site knows which quests you have finished, what is in your bank and what your KC is — things the Hiscores do not show.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">Without the plugin</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Scapestack only sees your Hiscores: levels and KC. Quests, diaries and your bank stay invisible, so the site guesses. It says so when it does.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">Connecting</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Connecting takes one button in the game and one in your browser.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">What it sends</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Your name, your levels, finished quests and diaries, your collection log, your Slayer task, and your bank if you switch that on.
              <span className="mt-1 block">Sync on login is optional and off by default. Bank can be turned off at any time.</span>
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">What it does not send</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Your password. Your inventory. Your chat. Where you are standing. Screenshots.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">The Sunday recap</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Once a week Scapestack can post what you banked — XP, levels, KC, log slots, and how far your goal moved — to a Discord channel you choose. One message, Sunday evening. A week with nothing in it is not sent.
              {/* REBRAND.md 6.6: show the recap rather than describe it. The
                  numbers are a worked example, not this account's — a page
                  that invented a real player's week would be the one thing
                  §9.3 exists to prevent. */}
              <div className="mt-3 max-w-sm">
                <ScrollRecap
                  rsn="lauky"
                  lines={[
                    { label: "XP", value: <RecapNumber>+1.2M</RecapNumber> },
                    { label: "Slayer", value: <RecapNumber>93</RecapNumber> },
                    { label: "Zulrah", value: <RecapNumber>+12</RecapNumber> },
                    { label: "Collection log", value: <RecapNumber>+3</RecapNumber> }
                  ]}
                  goal={{ target: "99 Slayer", percent: 82, remainder: "1.2M XP" }}
                />
              </div>
              <WeeklyRecapSettings />
            </dd>
          </div>
          <div className="py-4 last:pb-0">
            <dt className="text-[13px] font-bold text-[var(--color-text)]">Turning it off</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Uninstall the plugin, or press Forget me on Scapestack. Both stop it.
              <DeleteAccountDataButton />
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-[var(--color-border-strong)] pt-5">
          <h3 className="text-[13px] font-bold text-[var(--color-text)]">The RuneLite warning</h3>
          <blockquote className="mt-2 border-l border-[var(--color-parchment-edge)] pl-4 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
            “submits your IP address and comprehensive account data to a 3rd-party server not controlled or verified by RuneLite developers.”
          </blockquote>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            RuneLite shows that warning because the plugin sends account data to a server they do not run. That is accurate. The list above is exactly what it sends.
          </p>
        </div>
      </section>
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
