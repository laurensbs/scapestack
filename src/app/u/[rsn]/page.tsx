import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Shield, Sparkles, Trophy } from "lucide-react";
import {
  fetchHiscores, computeCombatLevel, computeTotalLevel, totalXp,
  formatXp, normalizeRsn
} from "@/lib/hiscores";
import { LocalBankSummary } from "./local-bank-summary";
import { skillSpriteUrl } from "@/lib/sprites";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { getSyncedPlayer } from "@/lib/sync-repo";
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
  const overallRank = hi.skills.find((s) => s.name === "Overall")?.rank ?? -1;
  const profileNextHref = nextUrlForProfile(hi.name);
  const pluginHref = pluginVerifyUrlForSyncedRsn(hi.name, "profile");
  const bankHref = bankOrganizerHref(hi.name, "profile");
  const synced = await getSyncedPlayer(hi.name);

  const runeliteLine = synced
    ? `RuneLite last checked ${formatProfileScanTime(synced.syncedAt)}.`
    : "Add RuneLite when finished quests, diaries, clog or Slayer matter.";
  const bankLine = synced?.bankItems.length
    ? `${synced.bankItems.length.toLocaleString()} bank stacks from RuneLite.`
    : "Paste Bank Memory or Bank Tags when gear, supplies or GP should change the route.";

  return (
    <main className="scape-page max-w-5xl">
      {/* The page IS the account. One identity block, one action, then the
          data — no welcome card, no chore tiles. The chores are plain links
          at the foot. */}
      <section className="mb-8 border-b border-[var(--color-border)] pb-6 animate-[slide-up_0.35s_ease-out]">
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
        <Link
          href={profileNextHref}
          className="scape-primary-action mt-5 inline-flex justify-between gap-4 text-[15px] sm:min-w-72"
        >
          Plan next trip <ArrowRight className="size-5" />
        </Link>
      </section>

      <AccountTimeline expectedRsn={hi.name} className="mb-6" limit={8} />

      {/* Bank summary if locally available */}
      <LocalBankSummary rsn={hi.name} />

      {/* Every skill with the data the old bordered boxes dropped: level, XP
          and rank, in the shared table. */}
      <section data-account-home-board="true">
        <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)] mb-3">
          Skills
        </h2>
        <div className="scape-table-wrap">
          <table className="scape-table" aria-label={`${hi.name}'s skills with level, XP and rank`}>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col" data-num>Level</th>
                <th scope="col" data-num>XP</th>
                <th scope="col" data-num>Rank</th>
              </tr>
            </thead>
            <tbody>
              {hi.skills.filter((s) => s.name !== "Overall").map((s) => (
                <SkillTableRow key={s.id} skill={s} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="scape-table-note">
          From the official Hiscores. Quests, diaries and worn gear are not visible there.
        </p>
      </section>

      {/* The chores: one hairline row of plain links, then what each input
          would add. */}
      <section className="mt-10 border-t border-[var(--color-border)] pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px]">
          <FootLink href={bankHref}>{synced?.bankItems.length ? "Update bank" : "Add bank"}</FootLink>
          <FootLink href={`/dps?rsn=${encodeURIComponent(hi.name)}&from=profile`}>Check kill</FootLink>
          <FootLink href={pluginHref}>{synced ? "Refresh RuneLite" : "Add RuneLite"}</FootLink>
        </div>
        <p className="scape-table-note">
          {bankLine} Scapestack can account for gear, supplies and unlocks. {runeliteLine}
        </p>
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

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center font-semibold text-[var(--color-text-secondary)] underline underline-offset-4 decoration-[var(--color-border-strong)] transition-colors hover:text-[var(--color-text)]"
    >
      {children}
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

function SkillTableRow({ skill }: { skill: import("@/lib/hiscores").HiscoreSkill }) {
  const level = skill.level > 0 ? skill.level : 1;
  const isCape = level === 99;
  const spriteUrl = skillSpriteUrl(skill.name);
  return (
    <tr>
      <th scope="row" className="whitespace-nowrap">
        <span className="flex items-center gap-2">
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
          {skill.name}
        </span>
      </th>
      {/* Inline style on purpose: .scape-table [data-num] sets the ink at
          higher specificity than a utility class. Gold marks 99 — maxed —
          the one thing a player scans this column for. */}
      <td data-num style={isCape ? { color: "var(--color-gold)" } : undefined}>{level}</td>
      <td data-num>{skill.xp > 0 ? formatXp(skill.xp) : "—"}</td>
      <td data-num>{skill.rank > 0 ? `#${skill.rank.toLocaleString()}` : "—"}</td>
    </tr>
  );
}
