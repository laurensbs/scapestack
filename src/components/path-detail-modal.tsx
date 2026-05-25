"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Circle, Search } from "lucide-react";
import { ICON_URL, cn } from "@/lib/utils";
import type { PathProgress } from "@/lib/path-progress";

interface Props {
  path: PathProgress;
  onClose: () => void;
}

// Drill-in modal for one path. Same modal shell as BossDetailModal —
// dark overlay, click-outside closes, Esc closes, body scroll locked.
// Layout: big ring + tagline left/top, search + done/open lists right/below.
export function PathDetailModal({ path, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return path.allSteps.filter((step) => {
      if (filter === "open" && step.status !== "open") return false;
      if (filter === "done" && step.status !== "done") return false;
      if (q && !step.title.toLowerCase().includes(q) && !step.why.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [path.allSteps, search, filter]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-modal-title"
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(7,9,12,0.82)] backdrop-blur-sm cursor-default"
      />

      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden bg-[var(--color-panel)] border border-[var(--color-border-strong)] shadow-[0_30px_80px_-12px_rgb(0_0_0/0.85)] flex flex-col"
        style={{ animation: "pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Header — title, ring, close. The whole strip is gradient-tinted
            so the modal feels like an extension of the path-card. */}
        <header className="relative px-5 py-5 sm:px-6 border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-accent)]/8 to-transparent">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 size-9 rounded-full flex items-center justify-center bg-[var(--color-bg)]/70 backdrop-blur border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-4 pr-12">
            <BigRing percent={path.percent} />
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-1">
                Path
              </div>
              <h2 id="path-modal-title" className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[var(--color-text)] leading-tight">
                {path.label}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-dim)] leading-snug">
                {path.tagline} · <span className="font-mono tabular-nums">{path.done}/{path.total}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Search + filter row */}
        <div className="px-5 sm:px-6 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-10 pr-3 py-2 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
            />
          </div>
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-0.5">
            {(["all", "open", "done"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11.5px] font-semibold uppercase tracking-wider transition-colors",
                  filter === f
                    ? "bg-[var(--color-accent)] text-[#07090C]"
                    : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Scrolling list */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">
              No steps match.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((step, i) => (
                <li
                  key={`${step.title}-${i}`}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-md border",
                    step.status === "done"
                      ? "bg-[var(--color-bg-2)]/40 border-[var(--color-border)]/50"
                      : "bg-[var(--color-bg-2)] border-[var(--color-border)]"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {step.status === "done" ? (
                      <Check className="size-4 text-[var(--color-good)]" />
                    ) : (
                      <Circle className="size-4 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  {step.iconItemId ? (
                    <img
                      src={ICON_URL(step.iconItemId)}
                      alt=""
                      width={18}
                      height={18}
                      className="pixelated shrink-0 mt-0.5"
                      style={{
                        imageRendering: "pixelated",
                        opacity: step.status === "done" ? 0.55 : 1
                      }}
                    />
                  ) : step.bossSlug ? (
                    <img
                      src={`/sprites/bosses/${step.bossSlug}.png`}
                      alt=""
                      width={22}
                      height={22}
                      className="shrink-0 mt-0.5 object-contain"
                      style={{ opacity: step.status === "done" ? 0.55 : 1 }}
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-[13px] font-semibold truncate",
                      step.status === "done" ? "text-[var(--color-text-dim)] line-through decoration-[1px]" : "text-[var(--color-text)]"
                    )}>
                      {step.title}
                    </div>
                    <div className="text-[11.5px] text-[var(--color-text-muted)] truncate">{step.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-5 sm:px-6 py-3 border-t border-[var(--color-border)] text-[10.5px] text-[var(--color-text-muted)] italic">
          Completion is a heuristic based on your skills + QP. We don&apos;t have a Jagex API for true quest/diary state, so individual items may be marked done early — flag yours as wrong if a key one&apos;s off.
        </footer>
      </div>
    </div>,
    document.body
  );
}

function BigRing({ percent }: { percent: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <div className="relative shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-border)" strokeWidth="4.5" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums text-[var(--color-text)]">
        {percent}%
      </div>
    </div>
  );
}
