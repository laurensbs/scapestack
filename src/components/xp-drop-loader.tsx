"use client";

import { useEffect, useState } from "react";

// OSRS XP-drop style loading indicator. Floats yellow monospace text
// up + out, cycles through the things we're actually doing under the
// hood: Hiscores fetch → bank parse → goal completion check. Each cycle
// is 1.4s so a typical 1-3s load shows 1-2 drops without feeling like
// the same drop repeating.
//
// Pure CSS keyframes (xp-drop in globals.css). The cycling itself
// is a tiny state + setTimeout — cheaper than a single animation that
// would have to coordinate three labels.
const STEPS = ["+1 Hiscores", "+1 Bank", "+1 Goals"] as const;

export function XpDropLoader() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % STEPS.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-flex items-center justify-center min-w-[150px] h-[1.25em]">
      {/* Underlying text is invisible — it reserves the width so the
          parent button doesn't jitter as the floating drop animates. */}
      <span className="opacity-0 select-none">Reading account…</span>
      <span
        key={idx}
        aria-live="polite"
        className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold whitespace-nowrap"
        style={{
          color: "var(--color-osrs-qty-yellow, #FFD43B)",
          textShadow: "1px 1px 0 rgb(0 0 0 / 0.85)",
          animation: "xp-drop 1.4s cubic-bezier(0.22, 1, 0.36, 1)"
        }}
      >
        {STEPS[idx]}
      </span>
    </span>
  );
}
