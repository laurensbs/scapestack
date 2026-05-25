"use client";

import { useState } from "react";
import { Sword, Target, Map as MapIcon, TrendingUp, ChevronRight, Check } from "lucide-react";
import { ICON_URL, cn } from "@/lib/utils";
import type { PathOverview as PathOverviewData, PathProgress } from "@/lib/path-progress";
import { PathDetailModal } from "./path-detail-modal";

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
          underneath show per-path balance at a glance. */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[12px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Path to Max
          </h2>
          <span className="text-[11.5px] text-[var(--color-text-muted)]">
            Estimated · uses skill/QP heuristics
          </span>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-5">
              <BigRing percent={data.overallPercent} />
              <div>
                <div className="text-[36px] sm:text-[44px] font-bold tabular-nums leading-none text-[var(--color-text)]">
                  {data.overallPercent}<span className="text-[24px] text-[var(--color-text-dim)]">%</span>
                </div>
                <div className="mt-1.5 text-[13px] text-[var(--color-text-dim)]">
                  of the full set complete
                </div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-2">
              {data.paths.map((p) => (
                <PathPill key={p.kind} path={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Four large path cards, each with their own next-steps preview.
          Click opens the drill-in modal with the full done/open list. */}
      <section>
        <div className="grid lg:grid-cols-2 gap-4">
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

// Big ring on the overall percent. Pure SVG, no chart lib.
function BigRing({ percent }: { percent: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
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
        style={{ transition: "stroke-dasharray 0.6s ease-out" }}
      />
    </svg>
  );
}

// Compact pill showing per-path percent inside the hero block. Acts as
// a legend for the bigger card grid below.
function PathPill({ path }: { path: PathProgress }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)]">
      <PathIcon kind={path.kind} size={20} />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{path.label}</div>
        <div className="text-[13.5px] font-bold tabular-nums text-[var(--color-text)] leading-tight">
          {path.percent}%
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
    <img
      src={ICON_URL(itemId)}
      alt=""
      className="pixelated"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        objectFit: "contain",
        filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
      className="group text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_0_1px_rgba(230,165,47,0.12)] transition-all p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <PathIcon kind={path.kind} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">
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
                <img
                  src={ICON_URL(step.iconItemId)}
                  alt=""
                  width={16}
                  height={16}
                  className="pixelated mt-0.5 shrink-0"
                  style={{ imageRendering: "pixelated" }}
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
