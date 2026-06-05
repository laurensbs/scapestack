"use client";

import { useMemo, useState } from "react";
import { Lightbulb, TrendingUp, AlertTriangle, X, ExternalLink, ListChecks, Copy, CheckCheck } from "lucide-react";
import { generateSuggestions, type Suggestion } from "@/lib/suggestions";
import { formatSuggestionActionPlan, getSuggestionPriority } from "@/lib/suggestion-text";
import type { OrganizedTab } from "@/lib/organizer";
import { cn, formatGp } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { ItemSprite } from "@/components/item-sprite";
import { wikiSearchUrl } from "@/lib/wiki";
import { bankSearchQueryForItems } from "@/lib/bank-search";

interface SuggestionsPanelProps {
  tabs: OrganizedTab[];
  onSearchItems?: (query: string, sourceLabel?: string) => void;
}

const DISMISSED_KEY = "scapestack-bank:dismissed-suggestions";
const COMPLETED_KEY = "scapestack-bank:completed-suggestions";

export function SuggestionsPanel({ tabs, onSearchItems }: SuggestionsPanelProps) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [completed, setCompleted] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [lastDismissed, setLastDismissed] = useState<{ id: string; title: string } | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{ id: string; title: string } | null>(null);

  const all = useMemo(() => generateSuggestions(tabs), [tabs]);
  const visible = all
    .filter((s) => !dismissed.includes(s.id) && !completed.includes(s.id))
    .sort((a, b) => getSuggestionPriority(a).rank - getSuggestionPriority(b).rank);

  const persistList = (key: string, values: string[]) => {
    try {
      if (values.length > 0) {
        localStorage.setItem(key, JSON.stringify(values));
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  };

  const dismiss = (id: string) => {
    const suggestion = all.find((entry) => entry.id === id);
    const next = Array.from(new Set([...dismissed, id]));
    setLastDismissed(suggestion ? { id, title: suggestion.title } : { id, title: "Suggestion" });
    setLastCompleted(null);
    setDismissed(next);
    persistList(DISMISSED_KEY, next);
  };

  const complete = (id: string) => {
    const suggestion = all.find((entry) => entry.id === id);
    const next = Array.from(new Set([...completed, id]));
    setLastCompleted(suggestion ? { id, title: suggestion.title } : { id, title: "Suggestion" });
    setLastDismissed(null);
    setCompleted(next);
    persistList(COMPLETED_KEY, next);
  };

  const reset = () => {
    setLastDismissed(null);
    setLastCompleted(null);
    setDismissed([]);
    setCompleted([]);
    persistList(DISMISSED_KEY, []);
    persistList(COMPLETED_KEY, []);
  };

  const restoreLastDismissed = () => {
    if (!lastDismissed) return;
    const next = dismissed.filter((dismissedId) => dismissedId !== lastDismissed.id);
    setDismissed(next);
    setLastDismissed(null);
    persistList(DISMISSED_KEY, next);
  };

  const restoreLastCompleted = () => {
    if (!lastCompleted) return;
    const next = completed.filter((completedId) => completedId !== lastCompleted.id);
    setCompleted(next);
    setLastCompleted(null);
    persistList(COMPLETED_KEY, next);
  };
  const hiddenCount = dismissed.length + completed.length;
  const suggestionsGridId = "smart-suggestions-grid";

  if (all.length === 0) return null;

  return (
    <section className="mt-7 mb-2" aria-label="Smart bank suggestions">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-[var(--color-gold-soft)]" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">
            Smart suggestions
          </h3>
          <span className="text-[11px] text-[var(--color-text-dim)]">
            {visible.length > 0 ? `${visible.length} for your bank` : "all hidden"}
          </span>
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={reset}
            aria-label={`Restore ${hiddenCount} hidden or completed smart suggestions`}
            className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline-offset-2 hover:underline"
          >
            Restore {hiddenCount} hidden/done
          </button>
        )}
      </div>

      {lastDismissed && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]"
        >
          <span>
            Hidden for now:{" "}
            <span className="font-semibold text-[var(--color-text)]">{lastDismissed.title}</span>.
          </span>
          <button
            type="button"
            onClick={restoreLastDismissed}
            aria-label={`Restore hidden suggestion ${lastDismissed.title}`}
            className="rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
          >
            Undo hide
          </button>
        </div>
      )}

      {lastCompleted && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/8 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]"
        >
          <span>
            Marked done for now:{" "}
            <span className="font-semibold text-[var(--color-text)]">{lastCompleted.title}</span>.
          </span>
          <button
            type="button"
            onClick={restoreLastCompleted}
            aria-label={`Restore completed suggestion ${lastCompleted.title}`}
            className="rounded-md border border-[var(--color-good)]/35 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-good)] hover:bg-[var(--color-good)]/15 transition-colors"
          >
            Undo done
          </button>
        </div>
      )}

      <div id={suggestionsGridId} className="grid sm:grid-cols-2 gap-2.5">
        {visible.map((s, i) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            index={i}
            onDismiss={() => dismiss(s.id)}
            onComplete={() => complete(s.id)}
            onSearchItems={onSearchItems}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)]/35 p-4 text-[12px] text-[var(--color-text-dim)]">
          <div className="font-semibold text-[var(--color-text)]">All smart suggestions are hidden.</div>
          <p className="mt-1">
            Restore them if you want Scapestack to re-check this bank for wiki-backed cleanup ideas or completed actions.
          </p>
            <button
              type="button"
              onClick={reset}
              aria-label="Restore every hidden or completed smart suggestion"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
            >
            Restore suggestions
          </button>
        </div>
      )}
    </section>
  );
}

function SuggestionCard({
  suggestion,
  index,
  onDismiss,
  onComplete,
  onSearchItems
}: {
  suggestion: Suggestion;
  index: number;
  onDismiss: () => void;
  onComplete: () => void;
  onSearchItems?: (query: string, sourceLabel?: string) => void;
}) {
  const { tone, title, body, gpImpact, actionHref, actionLabel } = suggestion;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [manualCopyText, setManualCopyText] = useState("");
  const matchedItems = suggestion.matchedItems
    ?? suggestion.itemIds?.map((id) => ({ id, name: `Item ID ${id}` }))
    ?? [];
  const bankSearchQuery = bankSearchQueryForItems(matchedItems);
  const priority = getSuggestionPriority(suggestion);
  const primaryAction = actionHref ? (actionLabel ?? "Open guide") : "Use action plan";
  const matchedItemCopy = matchedItems.length === 1 ? "1 matched item" : `${matchedItems.length} matched items`;
  const Icon = tone === "warning" ? AlertTriangle : tone === "win" ? TrendingUp : Lightbulb;
  const accent = {
    tip: { fg: "var(--color-gold-soft)", bg: "oklch(0.32 0.05 65 / 0.18)", line: "var(--color-gold-soft)" },
    warning: { fg: "var(--color-danger)", bg: "oklch(0.32 0.08 25 / 0.18)", line: "var(--color-danger)" },
    win: { fg: "var(--color-good)", bg: "oklch(0.32 0.08 145 / 0.18)", line: "var(--color-good)" }
  }[tone];

  const copySteps = async () => {
    const actionPlanText = formatSuggestionActionPlan(suggestion);
    const result = await copyText(actionPlanText);
    if (result !== "failed") {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } else {
      setManualCopyText(actionPlanText);
      setCopyState("error");
    }
  };

  return (
    <div
      aria-label={`Smart suggestion: ${title}`}
      className={cn(
        "relative group rounded-xl p-3.5",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-border)]",
        "shadow-[inset_0_1px_0_oklch(1_0_0/0.03)]",
        "hover:border-[var(--color-border-strong)] transition-colors"
      )}
      style={{ animation: `slide-up 0.3s ease-out ${index * 0.05}s both` }}
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
        style={{ background: accent.line }}
      />
      <div className="flex items-start gap-2.5">
        <div
          className="shrink-0 size-7 rounded-md flex items-center justify-center"
          style={{ background: accent.bg, color: accent.fg }}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[12.5px] font-semibold text-[var(--color-text)] leading-snug">
              {title}
            </h4>
            <span
              className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: accent.bg, color: accent.fg }}
              title={priority.reason}
            >
              {priority.label}
            </span>
            {gpImpact && (
              <span
                className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: accent.bg, color: accent.fg }}
              >
                {formatGp(gpImpact)} gp
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
            {body}
          </p>
          <div className="mt-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2.5">
            <div className="grid gap-1.5 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Why now
                </span>
                <span title={priority.reason}>{priority.reason}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Do next
                </span>
                <span className="font-semibold text-[var(--color-text)]">{primaryAction}</span>
                {matchedItems.length > 0 && <span aria-label={matchedItemCopy}>· {matchedItemCopy}</span>}
                {gpImpact && <span>· {formatGp(gpImpact)} gp impact</span>}
              </div>
            </div>
            {(onSearchItems && bankSearchQuery) || actionHref ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {onSearchItems && bankSearchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchItems(bankSearchQuery, title)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
                    title={`Search bank for ${bankSearchQuery}`}
                    aria-label={`Jump to affected bank items for ${title}`}
                  >
                    Jump to items
                    <ListChecks className="size-3" />
                  </button>
                )}
                {actionHref && (
                  <a
                    href={actionHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors"
                    style={{ borderColor: accent.line, color: accent.fg, background: accent.bg }}
                    aria-label={`Open primary guide for ${title}`}
                  >
                    Open guide
                    <ExternalLink className="size-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onComplete}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-good)]/35 bg-[var(--color-good)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-good)] hover:bg-[var(--color-good)]/15 transition-colors"
                  title="Mark this suggestion done for now"
                  aria-label={`Mark ${title} done for now from quick actions`}
                >
                  Mark done
                  <CheckCheck className="size-3" />
                </button>
              </div>
            ) : null}
          </div>
          {matchedItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Matched
              </span>
              {matchedItems.slice(0, 8).map((item) => (
                <a
                  key={item.id}
                  href={wikiSearchUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                  title={`${item.name} · ID ${item.id}`}
                  aria-label={`Open ${item.name} on OSRS Wiki`}
                >
                  <ItemSprite id={item.id} alt="" size={22} />
                </a>
              ))}
            </div>
          )}
          {suggestion.steps.length > 0 && (
            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <ListChecks className="size-3" />
                Action plan
              </div>
              <ol className="space-y-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
                {suggestion.steps.map((step, stepIndex) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[9px] font-bold text-[var(--color-accent)]">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onSearchItems && bankSearchQuery && (
              <button
                type="button"
                onClick={() => onSearchItems(bankSearchQuery, title)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
                title={`Search bank for ${bankSearchQuery}`}
                aria-label={`Find affected bank items for ${title}`}
              >
                Find in bank
                <ListChecks className="size-3" />
              </button>
            )}
            {actionHref && (
              <a
                href={actionHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors"
                style={{ borderColor: accent.line, color: accent.fg, background: accent.bg }}
                aria-label={`Open ${actionLabel ?? "guide"} for ${title}`}
              >
                {actionLabel ?? "Open guide"}
                <ExternalLink className="size-3" />
              </a>
            )}
            <button
              type="button"
              onClick={copySteps}
              aria-label={`Copy action steps for ${title}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 transition-colors"
            >
              {copyState === "copied" ? <CheckCheck className="size-3" /> : <Copy className="size-3" />}
              {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy steps"}
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-good)]/35 bg-[var(--color-good)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-good)] hover:bg-[var(--color-good)]/15 transition-colors"
              title="Mark this suggestion done for now"
              aria-label={`Mark ${title} done for now`}
            >
              Mark done
              <CheckCheck className="size-3" />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={`Mark ${title} not relevant`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Not relevant
              <X className="size-3" />
            </button>
          </div>
          {copyState === "error" && (
            <div className="mt-2 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2" aria-live="polite">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
                Clipboard failed — copy manually
              </label>
              <textarea
                readOnly
                value={manualCopyText}
                onFocus={(event) => event.currentTarget.select()}
                className="min-h-[86px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text)]"
                aria-label={`Manual copy fallback for ${title}`}
              />
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2.5 right-2.5 size-6 rounded flex items-center justify-center text-[var(--color-text-dim)]/60 hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
        title={`Dismiss ${title}`}
        aria-label={`Dismiss ${title} suggestion`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
