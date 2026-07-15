import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, DatabaseZap, PlugZap, Shield, Sparkles, Sword, Trophy } from "lucide-react";
import {
  fetchHiscores, computeCombatLevel, computeTotalLevel, totalXp,
  topSkills, formatXp, normalizeRsn
} from "@/lib/hiscores";
import { LocalBankSummary } from "./local-bank-summary";
import { cn } from "@/lib/utils";
import { skillSpriteUrl } from "@/lib/sprites";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { getSyncedPlayer, type SyncedPlayer, type SyncDeltaSummary } from "@/lib/sync-repo";
import { WeeklyRecap } from "./weekly-recap";

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
    <main className="relative z-10 mx-auto w-full max-w-5xl overflow-x-hidden px-4 py-8 pb-20 sm:px-5">
      {/* Hero card */}
      <section className="relative mb-6 max-w-full overflow-hidden rounded-2xl p-5 animate-[slide-up_0.35s_ease-out] sm:p-6"
        style={{
          background: "linear-gradient(135deg, var(--color-osrs-wood) 0%, var(--color-osrs-wood-dark) 100%)",
          border: "2px solid var(--color-osrs-wood-edge)",
          boxShadow: [
            "inset 1px 1px 0 var(--color-osrs-wood-light)",
            "inset -1px -1px 0 var(--color-osrs-wood-dark)",
            "0 10px 30px -10px rgb(0 0 0 / 0.6)"
          ].join(", ")
        }}>
        {/* Decorative scan-lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)" }} />

        <div className="relative flex min-w-0 flex-col items-start gap-6 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-[var(--color-gold-soft)] mb-1">
              Old School RuneScape
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-none tracking-normal mb-3"
              style={{
                color: "var(--color-osrs-title)",
                textShadow: "2px 2px 0 #000, 0 0 24px oklch(0.74 0.13 75 / 0.4)"
              }}>
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
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <Link
              href={profileNextHref}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold",
                "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)]",
                "text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)]",
                "shadow-[0_3px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
                "hover:brightness-110 hover:-translate-y-px transition-all"
              )}
            >
              Plan from profile <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href={pluginHref}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold",
                "border border-[var(--color-border)] bg-[var(--color-panel)]/80 text-[var(--color-text)]",
                "hover:border-[var(--color-gold)]/60 hover:text-[var(--color-gold)] transition-colors"
              )}
            >
              <PlugZap className="size-3.5" /> Sync RuneLite
            </Link>
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

      <WeeklyRecap
        rsn={hi.name}
        nextHref={profileNextHref}
        syncXpLine={profileSyncXpLine(synced?.lastSyncSummary ?? null)}
      />

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
  const changedLines = profileWhatChangedLines(synced?.lastSyncSummary ?? null);

  return (
    <section
      className={cn(
        "mb-6 rounded-2xl border border-[var(--color-gold)]/45 p-4 sm:p-5",
        "max-w-full overflow-hidden",
        "bg-gradient-to-br from-[var(--color-osrs-wood)] to-[var(--color-bg)]",
        "shadow-[0_24px_70px_-45px_oklch(0.74_0.13_75/0.8)]"
      )}
      data-account-home-board="true"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-gold)]/35 bg-black/20 px-3 py-1 text-[11px] font-bold text-[var(--color-gold)]">
            <CheckCircle2 className="size-3.5" />
            Account home
          </div>
          <h2 className="text-2xl font-black leading-tight text-[var(--color-text)] sm:text-4xl">
            Welcome back, {rsn}.
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            Start here every login. Scapestack keeps the account, bank and RuneLite context together so the next trip does not feel random.
          </p>

          <Link
            href={profileNextHref}
            className={cn(
              "mt-5 inline-flex w-full items-center justify-between gap-3 rounded-xl px-4 py-4 text-[15px] font-black sm:max-w-md",
              "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)]",
              "text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)]",
              "shadow-[0_4px_0_oklch(0_0_0/0.55),inset_0_1px_0_oklch(1_0_0/0.35)]",
              "hover:brightness-110 hover:-translate-y-px transition-all"
            )}
          >
            Plan next trip <ArrowRight className="size-5" />
          </Link>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ProfileQuickAction icon={DatabaseZap} href={bankHref} title={synced?.bankItems.length ? "Bank added" : "Add bank"} body={`${bankLine} Scapestack can account for gear, supplies and unlocks.`} />
            <ProfileQuickAction icon={Sword} href={`/dps?rsn=${encodeURIComponent(rsn)}&from=profile`} title="Check kill" body="Pick a boss and see gear, supplies and upgrades from your bank." />
            <ProfileQuickAction icon={PlugZap} href={pluginHref} title={synced ? "Refresh RuneLite" : "Add RuneLite"} body={runeliteLine} />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-black/18 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-gold)]">
              What changed
            </h3>
            {synced?.syncedAt && (
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                {formatProfileScanTime(synced.syncedAt)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {changedLines.length > 0 ? (
              changedLines.map((line) => (
                <div
                  key={line}
                  className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/8 px-3 py-2 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
                >
                  {line}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-3 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                {synced
                  ? "No new RuneLite changes yet. Do a trip, press Sync, then this page should show what moved."
                  : "No RuneLite scan yet. Add RuneLite once and this page can show XP, quests, diaries, clog and Slayer changes."}
              </div>
            )}
          </div>
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
      className="group min-w-0 rounded-xl border border-[var(--color-border)] bg-black/16 p-3 transition-colors hover:border-[var(--color-gold)]/55 hover:bg-[var(--color-gold)]/8"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-[var(--color-gold)]" />
        <span className="text-[13px] font-black text-[var(--color-text)]">{title}</span>
      </div>
      <p className="text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">{body}</p>
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

function profileWhatChangedLines(summary: SyncDeltaSummary | null): string[] {
  if (!summary) return [];
  const lines: string[] = [];
  for (const skill of summary.skills.slice(0, 3)) {
    const level = skill.currentLevel > skill.previousLevel
      ? `${skill.name} ${skill.previousLevel}->${skill.currentLevel}`
      : skill.name;
    const xp = skill.xpGained > 0 ? ` +${formatXp(skill.xpGained)}` : "";
    lines.push(`${level}${xp}`);
  }
  if (summary.questsCompleted.length > 0) {
    lines.push(`Finished quest: ${summary.questsCompleted.slice(0, 2).join(", ")}`);
  }
  if (summary.diariesCompleted.length > 0) {
    lines.push(`Diary done: ${summary.diariesCompleted.slice(0, 2).map((diary) => `${diary.region} ${diary.tier}`).join(", ")}`);
  }
  if (summary.collectionLogItems.length > 0) {
    lines.push(`New clog: ${summary.collectionLogItems.slice(0, 2).map((item) => item.name).join(", ")}`);
  } else if (summary.collectionLogItemIds.length > 0) {
    lines.push(`${summary.collectionLogItemIds.length.toLocaleString()} new clog item${summary.collectionLogItemIds.length === 1 ? "" : "s"}`);
  }
  if (summary.bank?.itemCountChanged) {
    lines.push(`Bank moved from ${summary.bank.previousItemCount.toLocaleString()} to ${summary.bank.currentItemCount.toLocaleString()} stacks`);
  }
  if (summary.accountType.changed) {
    lines.push("Account type changed; routes can shift.");
  }
  return lines.slice(0, 5);
}

function profileSyncXpLine(summary: SyncDeltaSummary | null): string | null {
  if (!summary) return null;
  const xpGained = summary.skills.reduce((sum, skill) => sum + Math.max(0, skill.xpGained), 0);
  if (xpGained <= 0) return null;
  const topSkill = summary.skills
    .filter((skill) => skill.xpGained > 0)
    .sort((a, b) => b.xpGained - a.xpGained)[0];
  return topSkill
    ? `${formatXp(xpGained)} XP since last scan; biggest move was ${topSkill.name}.`
    : `${formatXp(xpGained)} XP since last scan.`;
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
      "rounded-xl p-4 border border-[var(--color-border)]",
      "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]"
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
