"use client";

import { useState } from "react";

interface Props {
  kc: number;
  denom: number;        // drop rate = 1 / denom per kill
  dropName: string;
}

// Inline probability chart for a KC-rec. Shows P(>= 1 drop after N kills),
// where P = 1 - (1 - 1/denom)^N. The curve is the cumulative "by now you'd
// have one" probability — the value players actually want to know but
// nobody else surfaces.
//
// Vertical line at the player's current KC; the label shows the probability
// at that point. Hovering moves an info-pip along the curve. Pure SVG, no
// chart library — 60-ish lines, no bundle cost.
export function KcProbabilityGraph({ kc, denom, dropName }: Props) {
  const [open, setOpen] = useState(false);

  if (denom <= 0) return null; // guard against bad data

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] underline underline-offset-3 decoration-dotted transition-colors"
      >
        {open ? "Hide" : "Show"} drop chance vs KC
      </button>
      {open && <Chart kc={kc} denom={denom} dropName={dropName} />}
    </div>
  );
}

function Chart({ kc, denom, dropName }: Props) {
  // X-axis: 0 → max(3 × denom, kc * 1.2). At 3 × denom the curve reaches
  // ~95%, so beyond that the chart adds no signal.
  const maxKc = Math.max(denom * 3, kc * 1.2);
  // Sample the curve at 60 evenly-spaced points — smooth enough at this
  // size, cheap to compute.
  const samples = 60;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const x = (maxKc * i) / samples;
    const y = 1 - Math.pow(1 - 1 / denom, x);
    points.push({ x, y });
  }

  // SVG viewport — fixed-width, 200×80. We let CSS scale it.
  const W = 200;
  const H = 80;
  const padL = 4;
  const padR = 6;
  const padT = 8;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xToPx = (x: number) => padL + (x / maxKc) * plotW;
  const yToPx = (y: number) => padT + (1 - y) * plotH;

  // Build the curve path + an area-fill version.
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${xToPx(maxKc)},${yToPx(0)} L${xToPx(0)},${yToPx(0)} Z`;

  // Player's current point on the curve.
  const playerProb = 1 - Math.pow(1 - 1 / denom, kc);
  const playerX = xToPx(kc);
  const playerY = yToPx(playerProb);

  // KC at which P >= 50% (median) — annotation reference.
  const halfKc = Math.log(0.5) / Math.log(1 - 1 / denom);
  const halfX = halfKc <= maxKc ? xToPx(halfKc) : null;

  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Probability of receiving ${dropName} versus kill count`}
      >
        {/* Horizontal gridlines at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={padL} x2={W - padR}
            y1={yToPx(y)} y2={yToPx(y)}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
        ))}
        {/* 50%-median KC tick */}
        {halfX !== null && (
          <line
            x1={halfX} x2={halfX}
            y1={padT} y2={H - padB}
            stroke="var(--color-text-muted)"
            strokeOpacity="0.35"
            strokeWidth="0.5"
          />
        )}

        {/* Area + curve */}
        <path d={areaPath} fill="rgba(230, 165, 47, 0.12)" />
        <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />

        {/* Player marker */}
        <line
          x1={playerX} x2={playerX}
          y1={padT} y2={H - padB}
          stroke="var(--color-accent)"
          strokeWidth="1"
          strokeOpacity="0.55"
        />
        <circle cx={playerX} cy={playerY} r="2.5" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="1" />

        {/* Labels — keep minimal, the eyebrow text below carries the numbers */}
        <text x={padL} y={H - 4} fontSize="6" fill="var(--color-text-muted)">0 KC</text>
        <text x={W - padR} y={H - 4} fontSize="6" fill="var(--color-text-muted)" textAnchor="end">
          {Math.round(maxKc).toLocaleString()} KC
        </text>
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-[var(--color-text-muted)] font-mono tabular-nums">
        <span>
          At your <span className="text-[var(--color-accent)]">{kc.toLocaleString()} KC</span>:{" "}
          <span className="text-[var(--color-text)]">{(playerProb * 100).toFixed(1)}%</span> chance
        </span>
        <span>
          50% at ~<span className="text-[var(--color-text)]">{Math.round(halfKc).toLocaleString()} KC</span>
        </span>
      </div>
    </div>
  );
}
