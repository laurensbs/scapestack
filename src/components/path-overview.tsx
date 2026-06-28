"use client";

import { useEffect, useRef, useState } from "react";
import { Sword, Target, Map as MapIcon, TrendingUp, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathOverview as PathOverviewData, PathProgress } from "@/lib/path-progress";
import { CURRENT_PLUGIN_VERSION, isPluginVersionAtLeast } from "@/lib/plugin-sync";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { ItemSprite } from "./item-sprite";
import { PathDetailModal } from "./path-detail-modal";

// Choreography constants — the title types in over ~700ms, this strip
// lands 300ms after the title starts, and the ring fill + count-up
// runs across 1200ms once visible. Centralised so the hero feels like
// one composed sequence, not three loose animations.
const PATH_OVERVIEW_DELAY_MS = 1000; // title finishes ~900ms; +100ms breath
const RING_DURATION_MS = 1200;

// Pretty-print WOM's account-type strings for the synced badge.
function accountTypeLabel(t: NonNullable<PathOverviewData["accountMeta"]>["accountType"]): string {
  switch (t) {
    case "ironman":  return "Ironman";
    case "hardcore": return "Hardcore Ironman";
    case "ultimate": return "Ultimate Ironman";
    case "skiller":  return "Skiller";
    case "pure":     return "Pure";
    default:         return "Main";
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
      name: "Scapestack plugin",
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
  if (synced?.temple) {
    sources.push({
      name: "Temple quests",
      url: `https://templeosrs.com/player/quests.php?player=${encodeURIComponent(meta?.displayName ?? "")}`,
      primary: false
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
          Want synced progress? Check sync before setup →
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

// Path-to-Max overview — replaces the headline + grouped checklist on
// /next. Four cards, one per axis (Skills/Quests/Diaries/Bosses), each
// with a ring-progress + 3 next-steps. Click any card → drill-in modal
// with full done/open list.
//
// Visual mantra: less furniture. The old layout had a headline card +
// kind-glyph group headers + 2-col rec-grid. This is 4 cards with
// breathing room, hero progress bar above, no checkboxes.
export function PathOverview({ data }: { data: PathOverviewData }) {
  const [openPath, setOpenPath] = useState<PathProgress | null>(null);

  return (
    <>
      {/* Hero progress bar — one number, big. The four ring-indicators
          underneath show per-path balance at a glance. Lands 1s after
          the typing title finishes its reveal, so the eye can follow
          a single beat: title → progress → cards. */}
      <section
        className="mb-8"
        style={{
          animation: `path-overview-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both`,
          animationDelay: `${PATH_OVERVIEW_DELAY_MS}ms`
        }}
      >
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-[12px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Path to Max
          </h2>
          {/* Synced-sources badge. Shows every external tracker that
              had a record for this player (WOM/Temple/cl.net), so the
              heuristics-disclaimer carries real weight: 'when we say
              done, it's done — pulled from the plugin you use.' If no
              tracker had data we show the plain estimate footnote. */}
          <SyncedBadge data={data} />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-5">
              <BigRing
                percent={data.overallPercent}
                startDelayMs={PATH_OVERVIEW_DELAY_MS + 150}
                durationMs={RING_DURATION_MS}
              />
              <div>
                <div className="text-[36px] sm:text-[44px] font-bold tabular-nums leading-none text-[var(--color-text)]">
                  <CountUp
                    to={data.overallPercent}
                    startDelayMs={PATH_OVERVIEW_DELAY_MS + 150}
                    durationMs={RING_DURATION_MS}
                  />
                  <span className="text-[24px] text-[var(--color-text-dim)]">%</span>
                </div>
                <div className="mt-1.5 text-[13px] text-[var(--color-text-dim)]">
                  of the full set complete
                </div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-2">
              {data.paths.map((p, i) => (
                <PathPill
                  key={p.kind}
                  path={p}
                  // Stagger the pills 80ms each, starting once the ring
                  // is roughly half-filled (~600ms after PathOverview
                  // appears). Gives the strip a 'building outward' feel.
                  delayMs={PATH_OVERVIEW_DELAY_MS + 600 + i * 80}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Four large path cards, each with their own next-steps preview.
          Click opens the drill-in modal with the full done/open list.
          Cards stagger in 100ms apart, starting ~1.2s after the hero
          appears (the ring is mostly full by then). */}
      <section>
        <div className="grid lg:grid-cols-2 gap-4">
          {data.paths.map((path, i) => (
            <div
              key={path.kind}
              style={{
                animation: "path-card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
                animationDelay: `${PATH_OVERVIEW_DELAY_MS + 800 + i * 100}ms`
              }}
            >
              <PathCard path={path} onOpen={() => setOpenPath(path)} />
            </div>
          ))}
        </div>
      </section>

      {openPath && (
        <PathDetailModal path={openPath} onClose={() => setOpenPath(null)} />
      )}
    </>
  );
}

// Big ring on the overall percent. Pure SVG, no chart lib. Animates from
// 0 → target by starting with strokeDasharray="0 c" and flipping to
// final on mount + a tick — react picks up the transition.
function BigRing({
  percent,
  startDelayMs = 0,
  durationMs = 1200
}: {
  percent: number;
  startDelayMs?: number;
  durationMs?: number;
}) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const target = (percent / 100) * c;
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFilled(target), startDelayMs);
    return () => clearTimeout(t);
  }, [target, startDelayMs]);
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
      <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform="rotate(-90 40 40)"
        style={{ transition: `stroke-dasharray ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
      />
    </svg>
  );
}

// Count-up tween for percentage numbers. Eases out so the last few
// values feel like they're settling, not just hitting a hard stop.
function CountUp({
  to,
  startDelayMs = 0,
  durationMs = 1200
}: {
  to: number;
  startDelayMs?: number;
  durationMs?: number;
}) {
  const [n, setN] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const startTimer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        // ease-out-cubic — matches the ring fill curve closely enough
        // that the two move together but not so tightly that they
        // feel mechanically locked.
        const eased = 1 - Math.pow(1 - t, 3);
        setN(Math.round(to * eased));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, startDelayMs);
    return () => {
      clearTimeout(startTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, startDelayMs, durationMs]);
  return <>{n}</>;
}

// Compact pill showing per-path percent inside the hero block. Acts as
// a legend for the bigger card grid below. Animation delay is staggered
// from the hero so the four pills build outward as the ring fills.
function PathPill({ path, delayMs = 0 }: { path: PathProgress; delayMs?: number }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)]"
      style={{
        animation: "path-pill-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        animationDelay: `${delayMs}ms`
      }}
    >
      <PathIcon kind={path.kind} size={20} />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{path.label}</div>
        <div className="text-[13.5px] font-bold tabular-nums text-[var(--color-text)] leading-tight">
          <CountUp to={path.percent} startDelayMs={delayMs} durationMs={700} />%
        </div>
      </div>
    </div>
  );
}

// Path icon — pulls a representative OSRS sprite from chisel for now.
// Kept inline so the cards can reuse it without prop-drilling.
function PathIcon({ kind, size = 28 }: { kind: PathProgress["kind"]; size?: number }) {
  const itemId = kind === "skills" ? 9747 // attack cape
    : kind === "quests" ? 9813           // quest point cape
    : kind === "diaries" ? 11140         // karamja gloves 4
    : 4151;                              // abyssal whip → bosses
  return (
    <ItemSprite
      id={itemId}
      alt=""
      className="pixelated"
      style={{
        width: size,
        height: size,
        objectFit: "contain"
      }}
    />
  );
}

// Per-path card. Shows ring + label + tagline + the three next-step
// previews. Whole card is clickable; opens the drill-in modal.
function PathCard({ path, onOpen }: { path: PathProgress; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_0_1px_rgba(15, 118, 110,0.12)] transition-all p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <PathIcon kind={path.kind} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[18px] font-bold tracking-normal text-[var(--color-text)]">
              {path.label}
            </h3>
            <ChevronRight className="size-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-[12.5px] text-[var(--color-text-dim)] leading-snug">{path.tagline}</p>
        </div>
        <PathRing percent={path.percent} />
      </div>

      {/* Next-step preview list. Up to 3 rows; if there's nothing left
          (path complete) we say so explicitly. */}
      {path.nextSteps.length > 0 ? (
        <div className="mt-5 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Next steps</div>
          {path.nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)]"
            >
              {step.iconItemId ? (
                <ItemSprite
                  id={step.iconItemId}
                  alt=""
                  size={16}
                  className="pixelated mt-0.5 shrink-0"
                />
              ) : step.bossSlug ? (
                <img
                  src={`/sprites/bosses/${step.bossSlug}.png`}
                  alt=""
                  width={18}
                  height={18}
                  className="mt-0.5 shrink-0 object-contain"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">{step.title}</div>
                <div className="text-[11px] text-[var(--color-text-dim)] truncate">{step.why}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 px-3 py-2.5 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[12.5px] text-[var(--color-text-dim)]">
          <Check className="size-3.5 text-[var(--color-good)]" />
          {path.done === path.total ? "Path complete." : "No suggestions right now."}
        </div>
      )}
    </button>
  );
}

// Smaller progress ring used in the path-card header — same SVG pattern
// as BigRing but lighter weight.
function PathRing({ percent }: { percent: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <div className="relative shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[10.5px] font-bold tabular-nums text-[var(--color-text)]"
        style={{ paddingTop: 1 }}
      >
        {percent}
      </div>
    </div>
  );
}
