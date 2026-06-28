import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, DatabaseZap, PlugZap, Shield, Sparkles, Target, Trophy } from "lucide-react";
import {
  fetchHiscores, computeCombatLevel, computeTotalLevel, totalXp,
  topSkills, formatXp, normalizeRsn
} from "@/lib/hiscores";
import { LocalBankSummary } from "./local-bank-summary";
import { ProfileReadinessRail } from "./profile-readiness-rail";
import { cn } from "@/lib/utils";
import { skillSpriteUrl } from "@/lib/sprites";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";

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

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 py-8 pb-20">
      {/* Hero card */}
      <section className="relative overflow-hidden rounded-2xl p-6 mb-6 animate-[slide-up_0.35s_ease-out]"
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

        <div className="relative flex flex-col sm:flex-row items-start sm:items-end gap-6">
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
            <div className="flex flex-wrap gap-3 text-[12.5px]">
              <Stat icon={Shield} label="Combat" value={String(cb)} />
              <Stat icon={Trophy} label="Total" value={total.toLocaleString()} />
              <Stat icon={Sparkles} label="XP" value={formatXp(xp)} />
              {overallRank > 0 && (
                <Stat label="Rank" value={`#${overallRank.toLocaleString()}`} />
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href={profileNextHref}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold",
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
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold",
                "border border-[var(--color-border)] bg-[var(--color-panel)]/80 text-[var(--color-text)]",
                "hover:border-[var(--color-gold)]/60 hover:text-[var(--color-gold)] transition-colors"
              )}
            >
              <PlugZap className="size-3.5" /> Sync RuneLite
            </Link>
          </div>
        </div>
      </section>

      <ProfileActionRail rsn={hi.name} profileNextHref={profileNextHref} pluginHref={pluginHref} bankHref={bankHref} />

      <ProfileReadinessRail rsn={hi.name} />

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

function ProfileActionRail({
  rsn,
  profileNextHref,
  pluginHref,
  bankHref
}: {
  rsn: string;
  profileNextHref: string;
  pluginHref: string;
  bankHref: string;
}) {
  return (
    <section className="mb-6 grid gap-3 md:grid-cols-3">
      <ProfileActionCard
        icon={Target}
        href={profileNextHref}
        eyebrow="Best next move"
        title="Plan from profile"
        body={`Uses ${rsn}'s Hiscores as the starting point. RuneLite sync and bank context sharpen it and label which account coverage is verified.`}
        cta="Open plan"
        strong
      />
      <ProfileActionCard
        icon={PlugZap}
        href={pluginHref}
        eyebrow="Live state"
        title="Sync RuneLite"
        body="Verify the plugin setup so tasks, account context and later bank data stay connected instead of becoming separate flows."
        cta="Verify sync"
      />
      <ProfileActionCard
        icon={DatabaseZap}
        href={bankHref}
        eyebrow="Gear-aware"
        title="Upload bank"
        body="Paste Bank Memory or Bank Tags so recommendations account for gear, supplies and unlocks."
        cta="Add bank"
      />
    </section>
  );
}

function nextUrlForProfile(rsn: string): string {
  const params = new URLSearchParams();
  const cleanRsn = rsn.trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", "profile");
  return `/next?${params.toString()}`;
}

function ProfileActionCard({
  icon: Icon,
  href,
  eyebrow,
  title,
  body,
  cta,
  strong = false
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  strong?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border p-4 transition-all",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        strong
          ? "border-[var(--color-gold)]/55 shadow-[0_16px_40px_-24px_oklch(0.74_0.13_75/0.75)] hover:border-[var(--color-gold)]"
          : "border-[var(--color-border)] hover:border-[var(--color-gold)]/55",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-28px_rgb(0_0_0/0.85)]"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-black/20 text-[var(--color-gold)]">
          <Icon className="size-4" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-gold-soft)]">
          {eyebrow}
        </span>
      </div>
      <h2 className="text-lg font-black text-[var(--color-text)]">{title}</h2>
      <p className="mt-1 min-h-12 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-gold)]">
        {cta} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="size-3.5 text-[var(--color-gold-soft)]" />}
      <span className="text-[var(--color-text-dim)]/80">{label}</span>
      <span className="font-mono font-bold text-[var(--color-text)]">{value}</span>
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
