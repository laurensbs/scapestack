"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectBrowserModal } from "@/components/connect-browser-modal";

/**
 * One sentence about what Scapestack knows, replacing three that contradicted
 * each other.
 *
 * Driving the live site as the account owner on 2026-08-08, these three sat
 * within 200px of each other on /p/lauky:
 *
 *   "Ironman · 2202 total · 123 cb · synced 9 days ago"
 *   "Hiscores only — connect RuneLite for quests, diaries and your bank"
 *   "RuneLite filtered finished work"
 *
 * All three were true from a different gate. The planner runs server-side
 * against the full snapshot, so it really had filtered finished work; identity
 * is owner-gated behind the session cookie, so it really was showing hiscores
 * only; and the row really had been synced nine days ago. A player does not
 * read that as a privacy architecture. They read it as a product that does not
 * know what it knows.
 *
 * The missing state was the one in between: THIS ACCOUNT IS SYNCED AND THIS
 * BROWSER IS NOT PAIRED. Nothing on /p or /u ever said so, and the only way to
 * pair was a link to /plugin — a page about installing the plugin, which the
 * player already did. So the product asked its most invested users to redo
 * setup instead of offering the one step that was actually missing.
 */

export type AccountCoverageState =
  /** No RuneLite row for this RSN at all. */
  | { kind: "hiscores-only"; syncHref: string }
  /** A row exists, but this browser is not the paired one. */
  | { kind: "synced-unpaired"; syncedLabel: string }
  /** Paired owner: say what the last scan actually carried. */
  | { kind: "paired"; syncedLabel: string; missing: readonly string[] };

export function AccountCoverageLine({
  rsn,
  state
}: {
  rsn: string;
  state: AccountCoverageState;
}) {
  const [pairOpen, setPairOpen] = useState(false);

  if (state.kind === "hiscores-only") {
    return (
      <p className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]" data-account-coverage="hiscores-only">
        Hiscores only — <Link href={state.syncHref}>connect RuneLite for quests, diaries and your bank</Link>
      </p>
    );
  }

  if (state.kind === "synced-unpaired") {
    return (
      <>
        <p className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]" data-account-coverage="synced-unpaired">
          {/* The label already carries its own verb ("synced 9 days ago"), so
              the sentence must not add a second one. It read "RuneLite synced
              this account synced 9 days ago" on production for one deploy. */}
          RuneLite {state.syncedLabel}. This browser is not connected to it, so quests,
          diaries and your bank stay hidden.{" "}
          <button
            type="button"
            onClick={() => setPairOpen(true)}
            className="min-h-11 underline underline-offset-2 hover:text-[var(--color-text)]"
            data-pair-this-browser="true"
          >
            This is me
          </button>
        </p>
        <ConnectBrowserModal
          open={pairOpen}
          rsn={rsn}
          onClose={() => setPairOpen(false)}
          onConnected={() => window.location.reload()}
        />
      </>
    );
  }

  return (
    <p className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]" data-account-coverage="paired">
      {state.missing.length === 0
        ? `Hiscores + RuneLite, ${state.syncedLabel} — quests, diaries, collection log and bank all read.`
        : `Hiscores + RuneLite, ${state.syncedLabel} — not in that scan: ${state.missing.join(", ")}.`}
    </p>
  );
}
