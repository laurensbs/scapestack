"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Plus, Minus, ChevronDown, X } from "lucide-react";
import type { BankDiff } from "@/lib/diff";
import type { ScorePoint } from "@/lib/score-history";
import { cn, formatGp, formatQty } from "@/lib/utils";
import { ItemSprite } from "@/components/item-sprite";

interface Props {
  diff: BankDiff;
  history?: ScorePoint[];
  onDismiss: () => void;
}

export function DiffBanner({ diff, history = [], onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changedQuantity.length === 0
  ) {
    return null;
  }

  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const up = valueDelta >= 0;

  const sinceLabel =
    diff.daysSince === 0 ? "since today" :
    diff.daysSince === 1 ? "since yesterday" :
    `in ${diff.daysSince} days`;

  // Sort biggest impact first
  const topGains = diff.changedQuantity
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.deltaValue - a.deltaValue)
    .slice(0, 5);
  const topLosses = diff.changedQuantity
    .filter((c) => c.delta < 0)
    .sort((a, b) => a.deltaValue - b.deltaValue)
    .slice(0, 5);

  return (
    <section
      className="mb-5 rounded-xl overflow-hidden border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] animate-[slide-up_0.3s_ease-out]"
    >
      {/* Summary row (always visible). Outer is a flex row, only the
          left content area toggles expand; the dismiss X is its own button. */}
      <div className="flex items-center gap-3 pr-2 hover:bg-[var(--color-panel)]/40 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse change details" : "Expand change details"}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          <div
            className="shrink-0 size-9 rounded-lg flex items-center justify-center"
            style={{
              background: up ? "oklch(0.32 0.08 145 / 0.18)" : "oklch(0.32 0.08 25 / 0.18)",
              color: up ? "var(--color-good)" : "var(--color-danger)"
            }}
          >
            {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--color-text)]">
              Bank changed {sinceLabel}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-dim)] flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
              {diff.added.length > 0 && <span><Plus className="size-3 inline -mt-0.5" />{diff.added.length} new</span>}
              {diff.removed.length > 0 && <span><Minus className="size-3 inline -mt-0.5" />{diff.removed.length} gone</span>}
              {diff.changedQuantity.length > 0 && <span>{diff.changedQuantity.length} qty changed</span>}
              <span
                className="font-mono font-bold"
                style={{ color: up ? "var(--color-good)" : "var(--color-danger)" }}
              >
                {up ? "+" : ""}{formatGp(Math.abs(valueDelta))} gp
              </span>
            </div>
          </div>
          {history.length >= 2 && (
            <div className="hidden sm:flex items-center gap-2 mr-1 shrink-0">
              <Sparkline points={history} up={up} />
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                Score · {history.length}pt
              </span>
            </div>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-[var(--color-text-dim)] transition-transform shrink-0",
              expanded && "rotate-180"
            )}
          />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="size-7 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] shrink-0"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="grid sm:grid-cols-2 gap-px bg-[var(--color-border)]/40 border-t border-[var(--color-border)]">
          <DiffColumn
            title="Gained"
            tone="up"
            empty="Nothing new."
            items={[
              ...diff.added.map((it) => ({ id: it.id, name: it.name, qty: it.quantity, delta: it.quantity, value: it.stackValue })),
              ...topGains.map((c) => ({ id: c.id, name: c.name, qty: c.after, delta: c.delta, value: c.deltaValue }))
            ]}
          />
          <DiffColumn
            title="Lost"
            tone="down"
            empty="Nothing gone."
            items={[
              ...diff.removed.map((it) => ({ id: it.id, name: it.name, qty: 0, delta: -it.quantity, value: -it.stackValue })),
              ...topLosses.map((c) => ({ id: c.id, name: c.name, qty: c.after, delta: c.delta, value: c.deltaValue }))
            ]}
          />
        </div>
      )}
    </section>
  );
}

interface DiffItem {
  id: number;
  name: string;
  qty: number;
  delta: number;
  value: number;
}

function DiffColumn({ title, tone, empty, items }: { title: string; tone: "up" | "down"; empty: string; items: DiffItem[] }) {
  const accent = tone === "up" ? "var(--color-good)" : "var(--color-danger)";
  if (items.length === 0) {
    return (
      <div className="p-4 bg-[var(--color-bg-2)]">
        <div className="text-[11px] uppercase tracking-widest font-bold mb-2" style={{ color: accent }}>
          {title}
        </div>
        <div className="text-[12px] text-[var(--color-text-dim)] italic">{empty}</div>
      </div>
    );
  }
  return (
    <div className="p-4 bg-[var(--color-bg-2)]">
      <div className="text-[11px] uppercase tracking-widest font-bold mb-2" style={{ color: accent }}>
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 8).map((it) => (
          <li key={`${it.id}-${it.delta}`} className="flex items-center gap-2 text-[12px]">
            <ItemSprite
              id={it.id}
              alt=""
              loading="lazy"
              className="pixelated shrink-0 pointer-events-none"
              style={{
                maxWidth: "20px",
                maxHeight: "20px",
                width: "auto",
                height: "auto"
              }}
            />
            <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">{it.name}</span>
            <span
              className="font-mono tabular-nums text-[11px] font-semibold"
              style={{ color: it.delta >= 0 ? "var(--color-good)" : "var(--color-danger)" }}
            >
              {it.delta > 0 ? "+" : ""}{formatQty(Math.abs(it.delta))}
            </span>
            {it.value !== 0 && (
              <span
                className="text-[10.5px] tabular-nums"
                style={{ color: accent, opacity: 0.7 }}
              >
                {it.value > 0 ? "+" : ""}{formatGp(Math.abs(it.value))} gp
              </span>
            )}
          </li>
        ))}
        {items.length > 8 && (
          <li className="text-[11px] text-[var(--color-text-dim)] italic">+ {items.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}

// Compact SVG sparkline of the user's stack-score series. Shows the most
// recent ~30 organize sessions as a single line + endpoint dot.
function Sparkline({ points, up }: { points: ScorePoint[]; up: boolean }) {
  const W = 80;
  const H = 28;
  const PAD = 2;
  if (points.length < 2) return null;
  const min = Math.min(...points.map((p) => p.s));
  const max = Math.max(...points.map((p) => p.s));
  const span = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const norm = (s: number) => H - PAD - ((s - min) / span) * (H - PAD * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${PAD + i * stepX},${norm(p.s)}`)
    .join(" ");
  const lastX = PAD + (points.length - 1) * stepX;
  const lastY = norm(points[points.length - 1].s);
  const stroke = up ? "var(--color-good)" : "var(--color-danger)";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-90">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${lastX},${H - PAD} L${PAD},${H - PAD} Z`}
        fill="url(#spark-fill)"
      />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.2} fill={stroke}>
        <animate
          attributeName="r"
          values="2.2;3.4;2.2"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
