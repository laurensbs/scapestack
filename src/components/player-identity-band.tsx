import Image from "next/image";
import type { ReactNode } from "react";

interface PlayerIdentityBandProps {
  totalLevel: number;
  combatLevel: number;
  totalXp: number;
  questProgress: number | null;
  questTotal: number;
  diaryProgress: number | null;
  diaryTotal: number;
  collectionLogProgress: number | null;
  collectionLogTotal: number;
  coverage?: ReactNode;
  unknownReasons?: Partial<Record<"quests" | "diaries" | "collection-log", string>>;
}

const DEFAULT_UNKNOWN_REASONS = {
  quests: "Quest completion is not visible in Hiscores. Connect RuneLite to reveal it.",
  diaries: "Diary completion is not visible in Hiscores. Connect RuneLite to reveal it.",
  "collection-log": "Collection-log completion is not visible in Hiscores. Connect RuneLite to reveal it."
} as const;

type IdentityStatIcon = "total-level" | "combat" | "quests" | "diaries" | "collection-log";

function StatIcon({ icon }: { icon: IdentityStatIcon }) {
  return (
    <Image
      src={`/api/sprite/stat/${icon}.png`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      unoptimized
      className="pixelated size-5 shrink-0 object-contain"
      data-player-identity-icon={icon}
    />
  );
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function fraction(progress: number | null, total: number): string {
  return progress === null ? "—" : `${number(progress)} / ${number(total)}`;
}

export function PlayerIdentityBand({
  totalLevel,
  combatLevel,
  totalXp,
  questProgress,
  questTotal,
  diaryProgress,
  diaryTotal,
  collectionLogProgress,
  collectionLogTotal,
  coverage,
  unknownReasons
}: PlayerIdentityBandProps) {
  const stats = [
    { key: "total-level", label: "Total level", value: number(totalLevel), tone: "level", reason: null, icon: "total-level" },
    { key: "combat", label: "Combat", value: number(combatLevel), tone: "level", reason: null, icon: "combat" },
    { key: "total-xp", label: "Total XP", value: number(totalXp), tone: totalXp >= 10_000_000 ? "millions" : null, reason: null, icon: null },
    {
      key: "quests",
      label: "Quests",
      value: fraction(questProgress, questTotal),
      tone: questProgress === null ? "unknown" : null,
      reason: questProgress === null ? unknownReasons?.quests ?? DEFAULT_UNKNOWN_REASONS.quests : null,
      icon: "quests"
    },
    {
      key: "diaries",
      label: "Diaries",
      value: fraction(diaryProgress, diaryTotal),
      tone: diaryProgress === null ? "unknown" : null,
      reason: diaryProgress === null ? unknownReasons?.diaries ?? DEFAULT_UNKNOWN_REASONS.diaries : null,
      icon: "diaries"
    },
    {
      key: "collection-log",
      label: "Collection log",
      value: fraction(collectionLogProgress, collectionLogTotal),
      tone: collectionLogProgress === null ? "unknown" : null,
      reason: collectionLogProgress === null
        ? unknownReasons?.["collection-log"] ?? DEFAULT_UNKNOWN_REASONS["collection-log"]
        : null,
      icon: "collection-log"
    }
  ];

  return (
    <div className="mt-5" data-player-identity-band="true">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-4 md:grid-cols-6 md:gap-x-6">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="min-w-0 text-right"
            title={stat.reason ?? undefined}
            aria-label={stat.reason ? `${stat.label}: unknown. ${stat.reason}` : undefined}
            data-player-identity-stat={stat.key}
          >
            <dt className="truncate text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              {stat.label}
            </dt>
            <dd
              className={`mt-1 whitespace-nowrap tabular-nums font-[family-name:var(--font-rs)] text-[length:var(--text-rs)] leading-none ${
                stat.tone === "unknown"
                  ? "font-normal text-[var(--color-text-muted)]"
                  : stat.tone === "level"
                    ? "font-semibold text-[var(--color-data-level)]"
                    : stat.tone === "millions"
                      ? "font-semibold text-[var(--color-data-m)]"
                      : "font-semibold text-[var(--color-text)]"
              }`}
              data-player-identity-value={stat.key}
            >
              <span className="inline-flex items-baseline justify-end gap-2">
                {stat.icon ? <StatIcon icon={stat.icon as IdentityStatIcon} /> : null}
                <span>{stat.value}</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {/* A div, not a <p>: the coverage node brings its own paragraph since
          2026-08-08. A <p> inside a <p> is auto-closed by the parser, so the
          server HTML and the client DOM disagreed and React threw a hydration
          error (#418) on every /u render — invisible to 1,738 unit tests and
          caught immediately by the e2e that opens the page. */}
      {coverage ? (
        <div className="mt-4 max-w-[65ch] leading-relaxed" data-account-coverage="true">
          {coverage}
        </div>
      ) : null}
    </div>
  );
}
