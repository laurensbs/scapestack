import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, PlugZap, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
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
  description: "Enter an OSRS name, check sync, and get a cleaner next move."
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

const POST_SYNC_ACTIONS = [
  {
    label: "Plan next move",
    href: "/next?from=plugin&bank=none",
    handoff: true
  },
  {
    label: "Open Slayer",
    href: "/slayer?from=plugin",
    handoff: false
  },
  {
    label: "Add bank",
    href: "/bank?from=plugin",
    handoff: false
  }
] as const;

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
      body: "Check sync, then return to your plan.",
      cta: "Return to /next",
      href: `/next?${params.toString()}`
    };
  }

  if (from === "profile") {
    const profileParams = new URLSearchParams();
    profileParams.set("from", "plugin");
    if (bank === "none") profileParams.set("bank", "none");
    return {
      title: "From profile",
      body: "Check sync, then return.",
      cta: "Return to profile",
      href: rsn ? `/u/${encodeURIComponent(rsn)}?${profileParams.toString()}` : `/?${profileParams.toString()}`
    };
  }

  params.set("from", "plugin");
  return {
    title: `From /${from}`,
    body: "Check sync, then return.",
    cta: `Return to /${from}`,
    href: `/${from}?${params.toString()}`
  };
}

export function pluginHeroActions(): PluginHeroAction[] {
  return [
    {
      id: "verify",
      label: "Check sync",
      href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
      kind: "primary"
    },
    {
      id: "next",
      label: "Plan next move",
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
              Sync helps /next skip quests, diaries, log items and Slayer progress you already finished.
              You can still start with just an OSRS name.
            </p>
          </div>

          <div className="flex flex-wrap gap-3" aria-label="Scapestack Sync actions">
            {heroActions.map((action) => (
              <HeroActionLink key={action.id} action={action} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalPill icon={<Search className="size-4" />} title="Same name" body="Use the RuneLite display name you want to plan with." />
            <SignalPill icon={<RefreshCw className="size-4" />} title="Use .org" body={`Plugin v${CURRENT_PLUGIN_VERSION} should point to scapestack.org.`} />
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
                Use it when you want /next to know finished quests, diaries, collection log and Slayer.
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Sparkles className="size-6" />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              RuneLite sync link
            </div>
            <p className="mt-1 break-all text-[13px] font-semibold text-[var(--color-text)]">
              {PUBLIC_SYNC_URL}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              This must be the scapestack.org link before your RuneLite sync will show up here.
            </p>
            <div className="mt-3">
              <CopyCommand value={PUBLIC_SYNC_URL} label="Copy sync URL" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2.5">
            <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              Sync is optional. Use it when /next keeps suggesting progress you already completed.
            </p>
          </div>
        </aside>
      </section>

      {pluginContext && <PluginContextBanner context={pluginContext} />}

      <section className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-4">
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
      </section>

      <PluginSyncChecker />

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-good)]">
              Next
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              Sync found? Pick a route.
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              Start with /next. Add bank only when gear or GP matters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {POST_SYNC_ACTIONS.map((action, index) => (
              <PostSyncActionLink key={action.label} action={action} primary={index === 0} />
            ))}
          </div>
        </div>
      </section>

      <PluginBankHandoffBanner />

      <details className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-[var(--color-text)] marker:hidden">
          <span>Privacy and fixes</span>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--color-good)]">
            <ShieldCheck className="size-3.5" />
            No credentials
          </span>
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoTile title="Sync uses" body="Quests, diaries, collection log and Slayer. Scapestack only receives progress after you turn on sync in RuneLite." />
          <InfoTile title="Never uses" body="RuneScape password, bank, inventory, chat or screenshots." />
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

function PostSyncActionLink({
  action,
  primary
}: {
  action: (typeof POST_SYNC_ACTIONS)[number];
  primary: boolean;
}) {
  const className = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all",
    primary
      ? "bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110"
      : "border border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
  );
  const content = (
    <>
      {action.label}
      <ArrowRight className="size-3.5" />
    </>
  );

  if (action.handoff) return <PluginNextLink className={className}>{content}</PluginNextLink>;
  return <a href={action.href} className={className}>{content}</a>;
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">
      <h3 className="text-[13px] font-bold text-[var(--color-text)]">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{body}</p>
    </article>
  );
}
