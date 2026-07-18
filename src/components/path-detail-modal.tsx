"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Circle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathProgress } from "@/lib/path-progress";
import { ItemSprite } from "./item-sprite";
import { useDialogA11y } from "@/lib/use-dialog-a11y";

interface Props {
  path: PathProgress;
  onClose: () => void;
}

// One focused route sheet: title, search and a plain checklist.
export function PathDetailModal({ path, onClose }: Props) {
  const titleId = "path-modal-title";
  const descriptionId = "path-modal-description";
  const searchId = "path-modal-search";
  const searchStatusId = "path-modal-search-status";
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

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
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={dialogRef}
      tabIndex={-1}
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      <button
        type="button"
        aria-label={`Close ${path.label} path details`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(7,9,12,0.82)] backdrop-blur-sm cursor-default"
      />

      <div
        className="scape-sheet relative flex flex-col"
        style={{ animation: "pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <header className="relative border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${path.label} path details`}
            className="icon-btn absolute right-3 top-3"
          >
            <X className="size-4" />
          </button>
          <div className="pr-12">
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-1">
                Path
              </div>
              <h2 id={titleId} className="text-[22px] sm:text-[26px] font-bold tracking-normal text-[var(--color-text)] leading-tight">
                {path.label}
              </h2>
              <p id={descriptionId} className="mt-1 text-[13px] text-[var(--color-text-dim)] leading-snug">
                {path.tagline} · <span className="tabular-nums text-[var(--color-text)]">{path.done} of {path.total} done ({path.percent}%)</span>
              </p>
          </div>
        </header>

        {/* Search + filter row */}
        <div className="px-5 sm:px-6 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
            <label htmlFor={searchId} className="sr-only">
              Search steps in {path.label}
            </label>
            <input
              id={searchId}
              name="path-step-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={searchStatusId}
              className="w-full pl-10 pr-3 py-2 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
            />
            <p id={searchStatusId} role="status" aria-live="polite" className="sr-only">
              {filtered.length} path step{filtered.length === 1 ? "" : "s"} shown for {path.label}.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-0.5">
            {(["all", "open", "done"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                aria-label={`Show ${f} steps for ${path.label}`}
                className={cn(
                    "min-h-10 rounded-md px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
                  filter === f
                    ? "bg-[var(--color-accent)] text-[#0B1116]"
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
            <ul className="scape-checklist">
              {filtered.map((step, i) => (
                <li
                  key={`${step.title}-${i}`}
                  className={cn(
                    "flex items-start gap-3 px-1",
                    step.status === "done"
                      ? "opacity-65"
                      : ""
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
                    <ItemSprite
                      id={step.iconItemId}
                      alt=""
                      size={18}
                      className="pixelated shrink-0 mt-0.5"
                      style={{
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
                      "text-[13px] font-semibold leading-snug",
                      step.status === "done" ? "text-[var(--color-text-dim)] line-through decoration-[1px]" : "text-[var(--color-text)]"
                    )}>
                      {step.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-text-muted)]">{step.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-5 sm:px-6 py-3 border-t border-[var(--color-border)] text-[10.5px] text-[var(--color-text-muted)] italic">
          Scapestack estimates older steps from your account. Mark a step yourself when the estimate is wrong.
        </footer>
      </div>
    </div>,
    document.body
  );
}
