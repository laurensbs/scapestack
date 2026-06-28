"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
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
  presentation?: "modal" | "inline";
  title?: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryMode?: "clear" | "dismiss";
  tertiaryLabel?: string;
  /** "Continue" → caller triggers an organize flow with the stored
   *  banktags string. Caller also dismisses the modal. */
  onUse: () => void;
  /** "Decline" / "Don't save on this device" → caller dismisses the
   *  modal. The clear actions happen here. */
  onDismiss: () => void;
  /** Optional escape hatch for demo/sample flows. Keeps the saved bank
   *  intact unless the caller explicitly clears it. */
  onTertiary?: () => void;
}

// OSRS-style welcome-back modal. Replaces the original inline banner —
// the modal version reads as 'the game noticed your previous session,
// here's the standard yes/no dialog you've seen a thousand times in
// OSRS', whereas the banner was just a web alert. Three escape paths
// to keep this from being a rage-bait popup:
//   1. The big close-X in the corner (also fires onDismiss).
//   2. Esc closes (standard a11y).
//   3. Clicking the dark overlay outside the frame closes.
// And the three actions stay the same as the old banner: Continue /
// Decline / Don't save on this device.
export function SavedBankBanner({
  saved,
  loading,
  presentation = "modal",
  title = "Welcome back, adventurer",
  message,
  primaryLabel = "Continue",
  secondaryLabel = "Start fresh",
  secondaryMode = "clear",
  tertiaryLabel,
  onUse,
  onDismiss,
  onTertiary
}: Props) {
  const when = describeSavedAt(saved.savedAt);
  const body = message ?? `We still have your bank from ${when}. Load it back, or start fresh?`;
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);

  // a11y: trap focus on the primary action when the modal mounts.
  useEffect(() => {
    if (presentation !== "modal") return;
    continueBtnRef.current?.focus();
  }, [presentation]);

  // Esc closes — universally expected, missing is a smell.
  useEffect(() => {
    if (presentation !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, presentation]);

  // Lock body scroll while modal is open. Otherwise long pages scroll
  // behind the modal on iOS which looks broken.
  useEffect(() => {
    if (presentation !== "modal") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [presentation]);

  const startFresh = () => {
    if (secondaryMode === "clear") {
      clearSavedBank();
      clearSavedRsn();
    }
    onDismiss();
  };
  const dontSave = () => {
    disableSaveBankForSession(); // also clears
    clearSavedRsn();
    onDismiss();
  };
  const handleUse = () => {
    track("saved-bank:reuse");
    onUse();
  };

  const frame = (
    <div
      className={presentation === "modal"
        ? "relative w-full max-w-md rounded-md overflow-hidden"
        : "relative w-full rounded-md overflow-hidden text-left animate-[fade-in_0.2s_ease-out]"}
      style={{
        background: "linear-gradient(180deg, var(--color-osrs-wood-light) 0%, var(--color-osrs-wood) 100%)",
        border: "2px solid var(--color-osrs-wood-edge)",
        boxShadow: presentation === "modal"
          ? "0 24px 60px -8px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(134, 166, 217, 0.32)"
          : "0 16px 38px -26px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(134, 166, 217, 0.32)",
        animation: presentation === "modal" ? "pop-in 0.25s cubic-bezier(0.22, 1, 0.36, 1)" : undefined
      }}
    >
      {/* Title bar — OSRS-yellow uppercase, mimics the header on
          in-game dialog boxes ('Old School RuneScape' / 'Welcome!'). */}
      <div
        className="relative px-5 py-2.5 flex items-center justify-between"
        style={{
          background: "linear-gradient(180deg, var(--color-osrs-wood) 0%, var(--color-osrs-wood-dark) 100%)",
          borderBottom: "1px solid var(--color-osrs-wood-edge)"
        }}
      >
        <h2
          id="saved-bank-modal-title"
          className="text-[12px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: "var(--color-osrs-qty-yellow)",
            textShadow: "1px 1px 0 rgb(0 0 0)"
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="size-6 -mr-1 flex items-center justify-center rounded-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-osrs-wood-edge)] transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body — the actual message + actions */}
      <div className="px-5 py-5">
        <p className="text-[14px] text-[var(--color-text)] leading-relaxed">
          {message ? body : (
            <>
              We still have your bank from <span className="text-[var(--color-accent)] font-semibold">{when}</span>.
              Load it back, or start fresh?
            </>
          )}
        </p>
        <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)] leading-relaxed">
          Saved on this device only. Never on our server. Choose one path; the page behind this dialog is locked until you decide.
        </p>

        {/* Actions — primary big yellow OSRS-button, secondary as a
            quieter link below. The 'don't save here' opt-out sits
            under the divider as a footer-row link, so it's available
            but not competing visually with the primary CTA. */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <button
            ref={continueBtnRef}
            type="button"
            onClick={handleUse}
            disabled={loading}
            className="btn-primary group flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : primaryLabel}
            {!loading && <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />}
          </button>
          <button
            type="button"
            onClick={startFresh}
            className="btn-ghost flex-1 justify-center"
          >
            {secondaryLabel}
          </button>
        </div>

        {tertiaryLabel && onTertiary && (
          <button
            type="button"
            onClick={onTertiary}
            className="mt-2 w-full rounded-md border border-[var(--color-osrs-wood-edge)] bg-[rgba(7,9,12,0.24)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            {tertiaryLabel}
          </button>
        )}

        <div className="mt-4 pt-3 border-t border-[var(--color-osrs-wood-edge)] flex items-center justify-center">
          <button
            type="button"
            onClick={dontSave}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] underline underline-offset-3 decoration-dotted transition-colors"
          >
            Forget bank on this device
          </button>
        </div>
      </div>
    </div>
  );

  if (presentation === "inline") {
    return <div className="mb-4">{frame}</div>;
  }

  // SSR-safe portal: createPortal needs document.body which doesn't exist
  // on the server. Returning null on the server is fine — the modal
  // re-renders client-side as soon as the effect-driven 'savedBank'
  // state populates.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-bank-modal-title"
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      {/* Overlay — click-outside closes. Slightly tinted gold to keep
          the OSRS-fireplace feel of the rest of the rebrand. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onDismiss}
        className="absolute inset-0 bg-[rgba(7,9,12,0.78)] backdrop-blur-sm cursor-default"
        style={{
          background: "radial-gradient(closest-side, rgba(28, 24, 18, 0.85) 0%, rgba(7, 9, 12, 0.92) 100%)"
        }}
      />
      {frame}
    </div>,
    document.body
  );
}
