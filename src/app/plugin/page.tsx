import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, DatabaseZap, PlugZap, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { CopyCommand } from "@/components/copy-command";
import { PluginBankHandoffBanner } from "@/components/plugin-bank-handoff-banner";
import { PluginNextLink } from "@/components/plugin-next-link";
import { PluginSyncChecker } from "@/components/plugin-sync-checker";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Scapestack Sync",
  description: "Enter an OSRS name, verify Scapestack Sync, and get account-aware next actions."
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
    title: "Install Scapestack Sync",
    body: "Open RuneLite, add Scapestack Sync, and keep the plugin enabled for the account you want to plan."
  },
  {
    title: "Use the .org sync URL",
    body: `The default endpoint must be ${PUBLIC_SYNC_URL}. Old scapestack.app URLs will not show data here.`
  },
  {
    title: "Sync from RuneLite",
    body: "Enable Auto-sync on login or press Sync now after logging in. RuneLite shows chat feedback when the payload is posted."
  },
  {
    title: "Check the same RSN",
    body: "Enter the same OSRS display name below. When a payload exists, Scapestack can use it across /next, Slayer, goals and profiles."
  }
];

const ACCOUNT_SIGNALS = [
  "Quest completion",
  "Achievement Diary tiers",
  "Collection-log item IDs",
  "Slayer task, points, streak and blocks"
];

const NEXT_IDEAS = [
  {
    title: "Next best session",
    body: "Ranks quests, diaries, unlocks, bosses and cleanup tasks from the account signals Scapestack can prove.",
    cta: "Open /next",
    href: "/next?from=plugin&bank=none",
    handoff: true
  },
  {
    title: "Slayer path",
    body: "Turns the current task, blocks and points into a concrete task plan instead of generic Slayer advice.",
    cta: "Open Slayer",
    href: "/slayer?from=plugin"
  },
  {
    title: "Collection-log gaps",
    body: "Suppresses items already logged and highlights useful grinds for your current account state.",
    cta: "Use /next",
    href: "/next?from=plugin&bank=none",
    handoff: true
  },
  {
    title: "Bank-aware upgrades",
    body: "Add Bank Memory when you want gear and supplies included. The plugin never reads bank, inventory or equipment.",
    cta: "Add bank",
    href: "/bank?from=plugin"
  }
];

const DATA_SENT = [
  "RSN used for the sync check",
  "Plugin version and sync timestamp",
  "Quest and diary completion",
  "Collection-log item IDs loaded by RuneLite",
  "Slayer task, points, streak and block-list state"
];

const DATA_NEVER_SENT = [
  "RuneScape password or login session",
  "Bank, inventory, equipment or GE offers",
  "Chat messages, friends list or private messages",
  "Mouse clicks, key presses or gameplay inputs",
  "Screenshots, client files or RuneLite config folders"
];

const TROUBLESHOOTING = [
  "No result after typing your name? Confirm the RuneLite plugin sync URL is https://www.scapestack.org/api/sync.",
  "Still missing? Toggle Auto-sync on login off and on, relog, then press Check sync again.",
  "403 sync? Use Force claim retry once in the plugin config, then sync the same RuneLite account again.",
  "Collection log sparse? Open the Collection Log categories in-game once; RuneLite only exposes loaded widget data.",
  "Slayer task missing? Log in with the task visible to RuneLite, sync again, then refresh the checker."
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
      title: "You came from /next to verify sync",
      body: "Run the sync checker on this page first. Return to /next after it finds a verified payload for the same RSN.",
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

export function pluginHeroActions(): PluginHeroAction[] {
  return [
    {
      id: "verify",
      label: "Check Scapestack Sync",
      href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
      kind: "primary"
    },
    {
      id: "next",
      label: "Get next actions",
      href: "/next?from=plugin&bank=none",
      kind: "secondary",
      usesNextHandoff: true
    }
  ];
}

export default async function PluginPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const pluginContext = pluginContextFromSearchParams(resolvedSearchParams);
  const heroActions = pluginHeroActions();

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-18">
      <section className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
            <PlugZap className="size-3.5" />
            RuneLite Sync
          </div>

          <div>
            <h1 className="max-w-4xl text-[clamp(42px,7vw,76px)] font-bold leading-[0.96] tracking-tight text-[var(--color-text)]">
              Type your OSRS name.
              <span className="block text-gold-gradient">Get account-aware ideas.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-[1.55] text-[var(--color-text-dim)] sm:text-[19px]">
              Scapestack works with Hiscores and bank paste, but Scapestack Sync lets the app verify
              quests, diaries, collection-log items and Slayer state before recommending what to do next.
            </p>
          </div>

          <div className="flex flex-wrap gap-3" aria-label="Scapestack Sync actions">
            {heroActions.map((action) => (
              <HeroActionLink key={action.id} action={action} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalPill icon={<Search className="size-4" />} title="Name first" body="The RSN is the join key. Use the same display name RuneLite synced." />
            <SignalPill icon={<RefreshCw className="size-4" />} title="Fresh payload" body={`Current web contract expects plugin v${CURRENT_PLUGIN_VERSION} and the .org endpoint.`} />
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                Sync setup
              </div>
              <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
                Scapestack Sync
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Plugin v{CURRENT_PLUGIN_VERSION} posts account-state snapshots to Scapestack after opt-in.
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Sparkles className="size-6" />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Required sync URL
            </div>
            <p className="mt-1 break-all text-[13px] font-semibold text-[var(--color-text)]">
              {PUBLIC_SYNC_URL}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              If RuneLite still has scapestack.app saved, replace it with this .org URL and sync again.
            </p>
            <div className="mt-3">
              <CopyCommand value={PUBLIC_SYNC_URL} label="Copy sync URL" />
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {ACCOUNT_SIGNALS.map((signal) => (
              <div key={signal} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2.5 text-[13px] text-[var(--color-text)]">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--color-good)]" />
                {signal}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <TrustNote title="Explicit opt-in" body="Scapestack does not POST progress until you enable sync from RuneLite settings or press a sync action." />
            <TrustNote title="No account login" body="Scapestack never asks for your RuneScape password, session, clicks, screenshots or client files." />
          </div>
        </aside>
      </section>

      {pluginContext && <PluginContextBanner context={pluginContext} />}

      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SYNC_STEPS.map((step, index) => (
          <article
            key={step.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5"
          >
            <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[12px] font-bold text-[var(--color-accent)]">
              {index + 1}
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-[var(--color-text)]">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
          </article>
        ))}
      </section>

      <PluginSyncChecker />

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-good)]">
              After a successful sync
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              Turn the payload into the next thing to do.
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
              A verified payload helps Scapestack avoid generic OSRS advice. The app can recommend account-specific
              quests, diary steps, Slayer calls, collection-log cleanup and bank-aware upgrades.
            </p>
          </div>
          <PluginNextLink className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110">
            Get next actions <ArrowRight className="size-4" />
          </PluginNextLink>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {NEXT_IDEAS.map((idea) => (
            <IdeaCard key={idea.title} idea={idea} />
          ))}
        </div>
      </section>

      <PluginBankHandoffBanner />

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-good)]">
              Data contract
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              Opt-in account progress, not account access.
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
              The plugin sends only the progress signals needed for recommendations after you opt in inside RuneLite.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--color-good)]">
            <ShieldCheck className="size-3.5" />
            No credentials
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <DataListCard tone="good" title="Sent after opt-in" items={DATA_SENT} />
          <DataListCard tone="warning" title="Never sent" items={DATA_NEVER_SENT} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-warning)]">
          Troubleshooting
        </div>
        <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
          If your name shows nothing, fix the link first.
        </h2>
        <div className="mt-4 grid gap-2">
          {TROUBLESHOOTING.map((item) => (
            <div key={item} className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <DatabaseZap className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function HeroActionLink({ action }: { action: PluginHeroAction }) {
  const className = cn(
    "inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold transition-all",
    action.kind === "primary"
      ? "bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110"
      : "border border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
  );

  const content = (
    <>
      {action.label}
      <ArrowRight className="size-4" />
    </>
  );

  if (action.usesNextHandoff) {
    return (
      <PluginNextLink className={className}>
        {content}
      </PluginNextLink>
    );
  }

  return (
    <a href={action.href} className={className}>
      {content}
    </a>
  );
}

function PluginContextBanner({
  context
}: {
  context: NonNullable<ReturnType<typeof pluginContextFromSearchParams>>;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Keep context
          </div>
          <h2 className="mt-1 text-[18px] font-bold text-[var(--color-text)]">{context.title}</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">{context.body}</p>
        </div>
        <a
          href={context.href}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg)]/45 px-4 py-2.5 text-[13px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
        >
          {context.cta}
          <ArrowRight className="size-4" />
        </a>
      </div>
    </section>
  );
}

function SignalPill({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/65 p-3">
      <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--color-text)]">
        <span className="text-[var(--color-accent)]">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{body}</p>
    </div>
  );
}

function TrustNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-good)]">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{body}</p>
    </div>
  );
}

function IdeaCard({
  idea
}: {
  idea: (typeof NEXT_IDEAS)[number];
}) {
  const className = "mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)] hover:underline";
  const content = (
    <>
      {idea.cta}
      <ArrowRight className="size-3.5" />
    </>
  );

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">
      <h3 className="text-[15px] font-bold text-[var(--color-text)]">{idea.title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">{idea.body}</p>
      {idea.handoff ? (
        <PluginNextLink className={className}>{content}</PluginNextLink>
      ) : (
        <a href={idea.href} className={className}>{content}</a>
      )}
    </article>
  );
}

function DataListCard({
  tone,
  title,
  items
}: {
  tone: "good" | "warning";
  title: string;
  items: string[];
}) {
  const iconClass = tone === "good" ? "text-[var(--color-good)]" : "text-[var(--color-warning)]";
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">
      <h3 className="text-[14px] font-bold text-[var(--color-text)]">{title}</h3>
      <ul className="mt-3 grid gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
