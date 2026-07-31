"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BossSprite } from "@/components/boss-picker";
import { JournalItemSprite, JournalSpriteSlot, JournalStatusMark } from "@/components/journal-primitives";
import { BOSSES } from "@/lib/bosses";
import type { PathOverview as PathOverviewData, PathProgress } from "@/lib/path-progress";
import { CURRENT_PLUGIN_VERSION, isPluginVersionAtLeast } from "@/lib/plugin-sync";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { PathDetailModal } from "./path-detail-modal";

// Pretty-print WOM's account-type strings for the synced badge.
function accountTypeLabel(t: NonNullable<PathOverviewData["accountMeta"]>["accountType"]): string {
  switch (t) {
    case "ironman":  return "Ironman";
    case "hardcore": return "Hardcore Ironman";
    case "ultimate": return "Ultimate Ironman";
    case "group":    return "Group Ironman";
    case "skiller":  return "Skiller";
    case "pure":     return "Pure";
    default:         return "Normal";
  }
}

// Pretty-prints "5 min ago" / "2 hours ago" / "3 days ago" — the
// freshness signal next to a Scapestack sync. We round to one unit;
// the user just wants "is this current or stale", not a stopwatch.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

// Lists every tracker that returned data for this player. Falls back
// to the plain 'estimated' footnote when nothing matched. Each source
// gets a small dot + a link to the player's profile on that service.
//
// When the Scapestack plugin is the data-source we add a second line
// underneath with freshness + counts ("Synced 2 min ago · 47 quests ·
// 12 diaries · 234 CL items") so the user can confirm the plugin
// actually shipped its data. Plus a third line CTA when the plugin is
// NOT present, nudging users toward installing it.
function SyncedBadge({ data }: { data: PathOverviewData }) {
  const sources: Array<{ name: string; url: string | null; primary: boolean }> = [];
  const meta = data.accountMeta;
  const synced = data.syncedSources;
  const plugin = synced?.scapestack ?? null;
  const pluginOutdated = Boolean(plugin) && !isPluginVersionAtLeast(plugin?.pluginVersion);
  // Scapestack plugin wins primary slot when present — our own data is
  // the most authoritative.
  if (plugin) {
    sources.push({
      name: meta ? `Scapestack plugin · ${accountTypeLabel(meta.accountType)}` : "Scapestack plugin",
      url: null,
      primary: true
    });
  }
  if (meta && synced?.wom) {
    sources.push({
      name: `WOM · ${accountTypeLabel(meta.accountType)}`,
      url: `https://wiseoldman.net/players/${encodeURIComponent(meta.displayName)}`,
      primary: !plugin
    });
  }
  if (synced?.collectionLog) {
    sources.push({
      name: "Collection log",
      url: `https://collectionlog.net/log/${encodeURIComponent(meta?.displayName ?? "")}`,
      primary: false
    });
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col gap-1 text-[11.5px]">
        <span className="text-[var(--color-text-muted)]">
          Estimated · uses skill/QP heuristics
        </span>
        <a
          href={pluginVerifyUrlForSyncedRsn(meta?.displayName ?? "", "next")}
          className="text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"
        >
          Want RuneLite help? Check before setup →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="inline-flex items-center gap-2 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <span className="size-1.5 rounded-full bg-[var(--color-good)]" aria-hidden="true" />
          Synced
        </span>
        {sources.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-[var(--color-border-strong)]">·</span>}
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={s.primary
                  ? "text-[var(--color-accent)] hover:underline"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"}
              >
                {s.name}
              </a>
            ) : (
              <span className={s.primary ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"}>
                {s.name}
              </span>
            )}
          </span>
        ))}
      </div>
      {plugin && (
        <div className="text-[11px] text-[var(--color-text-dim)] tabular-nums">
          {pluginOutdated
            ? `Plugin v${plugin.pluginVersion ?? "unknown"} · update to v${CURRENT_PLUGIN_VERSION} for full Slayer sync`
            : `${relativeTime(plugin.syncedAt)} · ${plugin.quests} quests · ${plugin.diaries} diaries · ${plugin.clItems} CL items`}
        </div>
      )}
    </div>
  );
}

// A Journal overview is a list of exact counts. There is no synthetic ring or
// progress bar: each path carries its own visible done/total evidence.
export function PathOverview({ data }: { data: PathOverviewData }) {
  const [openPath, setOpenPath] = useState<PathProgress | null>(null);
  const overallDone = data.paths.reduce((sum, path) => sum + path.done, 0);
  const overallTotal = data.paths.reduce((sum, path) => sum + path.total, 0);

  return (
    <>
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="eyebrow">Max route</h2>
          <SyncedBadge data={data} />
        </div>
        <div className="border border-[var(--color-parchment-edge)] bg-[var(--color-panel)] p-4 sm:p-5">
          <p className="tabular-nums text-[22px] font-semibold text-[var(--color-text)]" data-journal-fraction="overall">
            {overallDone}/{overallTotal} tracked
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.paths.map((path) => <PathPill key={path.kind} path={path} />)}
          </div>
        </div>
      </section>

      <section>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.paths.map((path) => (
            <PathCard key={path.kind} path={path} onOpen={() => setOpenPath(path)} />
          ))}
        </div>
      </section>

      {openPath && (
        <PathDetailModal path={openPath} onClose={() => setOpenPath(null)} />
      )}
    </>
  );
}

function PathPill({ path }: { path: PathProgress }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border border-[var(--color-border)] bg-[var(--color-slot)] p-2">
      <PathIcon kind={path.kind} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{path.label}</div>
        <div className="tabular-nums text-[13.5px] font-bold leading-tight text-[var(--color-text)]">
          {path.done}/{path.total}
        </div>
      </div>
      <JournalStatusMark done={path.done === path.total && path.total > 0} />
    </div>
  );
}

function PathIcon({ kind }: { kind: PathProgress["kind"] }) {
  const itemId = kind === "skills" ? 9747 // attack cape
    : kind === "quests" ? 9813           // quest point cape
    : kind === "diaries" ? 11140         // karamja gloves 4
    : 4151;                              // abyssal whip → bosses
  return <JournalItemSprite id={itemId} />;
}

function PathStepSprite({ step }: { step: PathProgress["nextSteps"][number] }) {
  if (step.iconItemId) return <JournalItemSprite id={step.iconItemId} />;
  const boss = step.bossSlug ? BOSSES.find((candidate) => candidate.slug === step.bossSlug) : null;
  return boss ? (
    <JournalSpriteSlot>
      <BossSprite boss={boss} size={40} />
    </JournalSpriteSlot>
  ) : null;
}

function PathCard({ path, onOpen }: { path: PathProgress; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group border border-[var(--color-border-strong)] bg-[var(--color-panel)] p-4 text-left sm:p-5"
    >
      <div className="flex items-start gap-4">
        <PathIcon kind={path.kind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[18px] font-bold tracking-normal text-[var(--color-text)]">
              {path.label}
            </h3>
            <ChevronRight className="size-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-[12.5px] text-[var(--color-text-dim)] leading-snug">{path.tagline}</p>
        </div>
        <span className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{path.done}/{path.total}</span>
      </div>

      {path.nextSteps.length > 0 ? (
        <div className="mt-5 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Next steps</div>
          {path.nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 border border-[var(--color-border)] bg-[var(--color-slot)] p-2"
            >
              <PathStepSprite step={step} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">{step.title}</div>
                <div className="text-[11px] text-[var(--color-text-dim)] truncate">{step.why}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-slot)] px-3 py-2.5 text-[12.5px] text-[var(--color-text-dim)]">
          <JournalStatusMark done={path.done === path.total && path.total > 0} />
          {path.done === path.total ? "Path complete." : "No suggestions right now."}
        </div>
      )}
    </button>
  );
}
