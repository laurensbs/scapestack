"use client";

import { ArrowRight, Bookmark, X } from "lucide-react";
import {
  clearSavedBank,
  clearSavedRsn,
  describeSavedAt,
  disableSaveBankForSession,
  type SavedBank
} from "@/lib/saved-bank";
import { track } from "@/lib/analytics";

interface Props {
  saved: SavedBank;
  loading: boolean;
  /** "Use saved bank" → caller triggers an organize flow with the stored
   *  banktags string. Caller also closes the banner. */
  onUse: () => void;
  /** "Start fresh" / "Don't save on this device" → caller closes the
   *  banner. The clear actions happen in this component. */
  onDismiss: () => void;
}

// Welcome-back banner. Shown on /bank and /next when localStorage has a
// previously-organised bank. Three actions:
//   - Use saved bank — primary, runs the bank through the engine again.
//   - Start fresh    — quiet link, clears the saved bank but allows future
//                      saves on this device.
//   - Don't save on this device — escape hatch for shared browsers; clears
//                                 and blocks new saves for the session.
export function SavedBankBanner({ saved, loading, onUse, onDismiss }: Props) {
  const when = describeSavedAt(saved.savedAt);

  const startFresh = () => {
    clearSavedBank();
    clearSavedRsn();
    onDismiss();
  };
  const dontSave = () => {
    disableSaveBankForSession(); // also clears
    clearSavedRsn();
    onDismiss();
  };

  return (
    <div
      className="mb-6 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3.5 flex flex-wrap items-center gap-3 animate-[fade-in_0.3s_ease-out]"
      role="region"
      aria-label="Saved bank"
    >
      <div className="size-9 shrink-0 rounded-md flex items-center justify-center bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)]">
        <Bookmark className="size-4" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-[13.5px] text-[var(--color-text)] leading-snug">
          <span className="font-semibold">Welcome back</span>
          {" "}— we still have your bank from{" "}
          <span className="text-[var(--color-text-dim)]">{when}</span>.
        </p>
        <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
          Saved on this device only. We never store banks on our server.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { track("saved-bank:reuse"); onUse(); }}
          disabled={loading}
          className="btn-primary group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading…" : "Use saved bank"}
          {!loading && <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />}
        </button>
        <button
          type="button"
          onClick={startFresh}
          className="text-[12px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline underline-offset-4 decoration-dotted transition-colors"
        >
          Start fresh
        </button>
        <button
          type="button"
          onClick={dontSave}
          className="size-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] hover:bg-[var(--color-bg-2)] transition-colors"
          title="Don't save on this device for this session"
          aria-label="Don't save on this device"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
