"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * "What changed since last time" — the second reason to open the page.
 *
 * /api/account/refresh has been built, public, rate-limited and
 * self-registering for a while, and nothing in the product called it. It reads
 * Jagex once through the same write path the cron uses and hands back the
 * delta, so a player who just finished a trip can see the trip land instead of
 * being told to come back tomorrow.
 *
 * It sits on the header line, not in a section: /p holds three sections and a
 * new one may only arrive in a commit that removes one.
 *
 * Every click also writes a hiscore_snapshot row, which is what the weekly
 * recap, the goal percentage and the milestone ledger all read. The control is
 * a reason to return AND the thing that makes returning measurable.
 */

interface RefreshResult {
  ok?: boolean;
  /** Null on the first reading. Unknown, which is not zero. */
  since?: string | null;
  xpGained?: number;
  levelsGained?: number;
  levelUps?: Array<{ skill: string; from: number; to: number }>;
  kcGained?: Record<string, number>;
  moved?: boolean;
  milestones?: number;
  error?: string;
}

function compact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1))}M`;
  }
  if (value >= 1_000) {
    const thousands = Math.round(value / 1_000);
    return thousands >= 1_000 ? "1M" : `${thousands}k`;
  }
  return String(Math.round(value));
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function sinceLabel(since: string): string {
  const then = new Date(since).getTime();
  if (!Number.isFinite(then)) return "last check";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
}

/**
 * The result as a player would say it: counted in XP, levels and KC, never in
 * percentages of nothing. Clauses with no number are dropped rather than
 * written as zero.
 */
export function refreshSummary(result: RefreshResult): string {
  if (result.since === null || result.since === undefined) {
    // Nothing to compare against yet. Saying "+0 xp" here would report a
    // player's first reading as a week in which they did nothing.
    return "First reading saved. Come back after a trip and this line says what moved.";
  }
  const parts: string[] = [];
  if ((result.xpGained ?? 0) > 0) parts.push(`+${compact(result.xpGained!)} xp`);
  for (const up of (result.levelUps ?? []).slice(0, 2)) {
    parts.push(`${titleCase(up.skill)} ${up.to}`);
  }
  const kc = Object.entries(result.kcGained ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (kc) parts.push(`${titleCase(kc[0])} +${kc[1]}`);

  if (parts.length === 0) return `Nothing moved since ${sinceLabel(result.since)}.`;
  return `${parts.join(" · ")} since ${sinceLabel(result.since)}.`;
}

export function AccountRefreshLine({ rsn }: { rsn: string }) {
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setLine(null);
    try {
      const response = await fetch("/api/account/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rsn })
      });
      const body = await response.json().catch(() => ({})) as RefreshResult;
      // A 429 is a real answer — "already checked" — not a failure to hide.
      setLine(response.ok ? refreshSummary(body) : (body.error ?? "Could not check right now."));
    } catch {
      setLine("Could not check right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2" data-account-refresh="true">
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        aria-label={`Check the hiscores for ${rsn} again`}
        className="inline-flex items-center gap-1 text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)] underline underline-offset-2 disabled:opacity-60"
      >
        {busy
          ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          : <RefreshCw className="size-3" aria-hidden="true" />}
        Check again
      </button>
      {line && (
        <span
          role="status"
          data-refresh-result="true"
          className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]"
        >
          {line}
        </span>
      )}
    </span>
  );
}
