import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, DatabaseZap, PlugZap, Shield, Sparkles, Sword, Trophy } from "lucide-react";
import {
  fetchHiscores, computeCombatLevel, computeTotalLevel, totalXp,
  topSkills, formatXp, normalizeRsn
} from "@/lib/hiscores";
import { LocalBankSummary } from "./local-bank-summary";
import { cn } from "@/lib/utils";
import { skillSpriteUrl } from "@/lib/sprites";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { getSyncedPlayer, type SyncedPlayer } from "@/lib/sync-repo";
import { AccountTimeline } from "@/components/account-timeline";

interface Props {
  params: Promise<{ rsn: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { rsn } = await params;
  const decoded = decodeURIComponent(rsn);
  const hi = await fetchHiscores(decoded);
  if (!hi) {
    return { title: `${decoded} · Scapestack` };
  }
  const cb = computeCombatLevel(hi.skills);
  const total = computeTotalLevel(hi.skills);
  return {
    title: `${hi.name} · ${total} total · ${cb} cb`,
    description: `${hi.name}'s OSRS profile on Scapestack — ${total} total level, combat ${cb}, ${formatXp(totalXp(hi.skills))} XP.`,
    openGraph: {
      title: `${hi.name} · Scapestack`,
      description: `${total} total · combat ${cb} · ${formatXp(totalXp(hi.skills))} XP`,
      type: "profile"
    },
    twitter: {
      card: "summary_large_image",
      title: `${hi.name} on Scapestack`,
      description: `${total} total · combat ${cb}`
    }
  };
}

export default async function PlayerProfile({ params }: Props) {
  const { rsn } = await params;
  const decoded = normalizeRsn(decodeURIComponent(rsn));
  const hi = await fetchHiscores(decoded);
  if (!hi) notFound();

  const cb = computeCombatLevel(hi.skills);
  const total = computeTotalLevel(hi.skills);
  const xp = totalXp(hi.skills);
  const top = topSkills(hi.skills, 3);
  const overallRank = hi.skills.find((s) => s.name === "Overall")?.rank ?? -1;
  const profileNextHref = nextUrlForProfile(hi.name);
  const pluginHref = pluginVerifyUrlForSyncedRsn(hi.name, "profile");
  const bankHref = bankOrganizerHref(hi.name, "profile");
  const synced = await getSyncedPlayer(hi.name);

  return (
    <main className="scape-page max-w-5xl">
      <section className="mb-8 border-b border-[var(--color-border)] pb-6 animate-[slide-up_0.35s_ease-out]">
        <div className="min-w-0">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2 text-[var(--color-gold)]">Old School RuneScape</p>
            <h1 className="mb-3 text-4xl font-semibold leading-none text-[var(--color-text)] sm:text-6xl">
              {hi.name}
            </h1>
            <div className="flex min-w-0 flex-wrap gap-3 text-[12.5px]">
              <Stat icon={Shield} label="Combat" value={String(cb)} />
              <Stat icon={Trophy} label="Total" value={total.toLocaleString()} />
              <Stat icon={Sparkles} label="XP" value={formatXp(xp)} />
              {overallRank > 0 && (
                <Stat label="Rank" value={`#${overallRank.toLocaleString()}`} />
              )}
            </div>
          </div>
        </div>
      </section>

      <AccountHomeBoard
        rsn={hi.name}
        profileNextHref={profileNextHref}
        pluginHref={pluginHref}
        bankHref={bankHref}
        synced={synced}
      />

      <AccountTimeline expectedRsn={hi.name} className="mb-6" limit={8} />

      {/* Bank summary if locally available */}
      <LocalBankSummary rsn={hi.name} />

      {/* Top 3 skills */}
      <section className="mb-6">
        <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)] mb-3">
          Top skills
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {top.map((s, i) => (
            <SkillCard key={s.id} skill={s} rank={i + 1} />
          ))}
        </div>
      </section>

      {/* Full skill table */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)] mb-3">
          All skills
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {hi.skills.filter((s) => s.name !== "Overall").map((s) => (
            <SkillRow key={s.id} skill={s} />
          ))}
        </div>
      </section>

      {/* Footer nav */}
      <div className="mt-10 flex items-center justify-center">
        <Link href="/" className="text-[12px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] inline-flex items-center gap-1.5">
          <ArrowLeft className="size-3.5" /> All tools
        </Link>
      </div>
    </main>
  );
}

function AccountHomeBoard({
  rsn,
  profileNextHref,
  pluginHref,
  bankHref,
  synced
}: {
  rsn: string;
  profileNextHref: string;
  pluginHref: string;
  bankHref: string;
  synced: SyncedPlayer | null;
}) {
  const runeliteLine = synced
    ? `RuneLite last checked ${formatProfileScanTime(synced.syncedAt)}`
    : "Add RuneLite when finished quests, diaries, clog or Slayer matter.";
  const bankLine = synced?.bankItems.length
    ? `${synced.bankItems.length.toLocaleString()} bank stacks from RuneLite`
    : "Paste Bank Memory or Bank Tags when gear, supplies or GP should change the route.";
  return (
    <section
      className="scape-focus mb-10 max-w-full overflow-hidden p-5 sm:p-7"
      data-account-home-board="true"
    >
      <div className="min-w-0">
          <h2 className="text-3xl font-semibold leading-tight text-[var(--color-text)] sm:text-5xl">
            Welcome back, {rsn}.
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            Start here every login. Scapestack keeps the account, bank and RuneLite context together so the next trip does not feel random.
          </p>

          <Link
            href={profileNextHref}
            className="scape-primary-action mt-5 w-full justify-between text-[15px] sm:max-w-md"
          >
            Plan next trip <ArrowRight className="size-5" />
          </Link>

          <div className="scape-checklist mt-6 grid sm:grid-cols-3">
            <ProfileQuickAction icon={DatabaseZap} href={bankHref} title={synced?.bankItems.length ? "Bank added" : "Add bank"} body={`${bankLine} Scapestack can account for gear, supplies and unlocks.`} />
            <ProfileQuickAction icon={Sword} href={`/dps?rsn=${encodeURIComponent(rsn)}&from=profile`} title="Check kill" body="Pick a boss and see gear, supplies and upgrades from your bank." />
            <ProfileQuickAction icon={PlugZap} href={pluginHref} title={synced ? "Refresh RuneLite" : "Add RuneLite"} body={runeliteLine} />
          </div>
      </div>
    </section>
  );
}

function ProfileQuickAction({
  icon: Icon,
  href,
  title,
  body
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-20 min-w-0 items-start gap-3 px-1 py-3 transition-colors hover:bg-black/15 sm:px-3"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--color-gold)]" />
      <div className="min-w-0">
        <span className="text-[13px] font-black text-[var(--color-text)]">{title}</span>
        <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">{body}</p>
      </div>
    </Link>
  );
}

function formatProfileScanTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "scan time unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function nextUrlForProfile(rsn: string): string {
  const params = new URLSearchParams();
  const cleanRsn = rsn.trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", "profile");
  return `/next?${params.toString()}`;
}

function Stat({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {Icon && <Icon className="size-3.5 text-[var(--color-gold-soft)]" />}
      <span className="shrink-0 text-[var(--color-text-dim)]/80">{label}</span>
      <span className="min-w-0 truncate font-mono font-bold text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function SkillCard({ skill, rank }: { skill: import("@/lib/hiscores").HiscoreSkill; rank: number }) {
  const spriteUrl = skillSpriteUrl(skill.name);
  return (
    <div className={cn(
      "scape-route-choice p-4"
    )}>
      <div className="flex items-center gap-2 mb-1">
        {spriteUrl && (
          <img
            src={spriteUrl}
            alt=""
            width={16}
            height={16}
            className="pixelated"
            style={{ imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
          />
        )}
        <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gold-soft)]">
          #{rank} · {skill.name}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-black text-[var(--color-gold)] leading-none">{skill.level}</span>
        <span className="text-[var(--color-text-dim)] text-[11px]">/ 99</span>
      </div>
      <div className="text-[11.5px] text-[var(--color-text-dim)] font-mono">
        {formatXp(skill.xp)} XP · rank #{skill.rank > 0 ? skill.rank.toLocaleString() : "—"}
      </div>
    </div>
  );
}

function SkillRow({ skill }: { skill: import("@/lib/hiscores").HiscoreSkill }) {
  const level = skill.level > 0 ? skill.level : 1;
  const isCape = level === 99;
  const spriteUrl = skillSpriteUrl(skill.name);
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5 rounded",
        "bg-[var(--color-panel)]/40 border border-[var(--color-border)]"
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        {spriteUrl && (
          <img
            src={spriteUrl}
            alt=""
            width={14}
            height={14}
            className="pixelated shrink-0"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <span className="text-[12px] text-[var(--color-text)] font-medium truncate">{skill.name}</span>
      </span>
      <span className={cn(
        "font-mono font-bold text-[12px] tabular-nums",
        isCape ? "text-[var(--color-gold)]" : "text-[var(--color-text)]"
      )}>
        {level}
      </span>
    </div>
  );
}
