"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardPaste, ExternalLink, X } from "lucide-react";
import { BankSetupSteps } from "@/components/bank-setup-steps";
import { getActiveAccount } from "@/lib/account-storage";
import { loadSavedRsn, saveSavedBank, saveSavedRsn } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

interface AddBankModalProps {
  open: boolean;
  onClose: () => void;
  rsn?: string | null;
  initialBank?: string;
  source?: string;
  onSaved?: (bank: string, rsn: string) => void;
}

type PasteState = "idle" | "pasted" | "empty" | "blocked" | "saved";

export function AddBankModal({
  open,
  onClose,
  rsn,
  initialBank = "",
  source = "next",
  onSaved
}: AddBankModalProps) {
  const [bank, setBank] = useState(initialBank);
  const [pasteState, setPasteState] = useState<PasteState>("idle");
  const effectiveRsn = useMemo(() => {
    if (!open) return "";
    return (rsn ?? getActiveAccount()?.rsn ?? loadSavedRsn() ?? "").trim();
  }, [open, rsn]);
  const fullOrganizerHref = effectiveRsn
    ? `/bank?rsn=${encodeURIComponent(effectiveRsn)}&from=${encodeURIComponent(source)}`
    : `/bank?from=${encodeURIComponent(source)}`;

  useEffect(() => {
    if (!open) return;
    setBank(initialBank);
    setPasteState("idle");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [initialBank, onClose, open]);

  if (!open) return null;

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setPasteState("empty");
        return;
      }
      setBank(text);
      setPasteState("pasted");
    } catch {
      setPasteState("blocked");
    }
  };

  const save = () => {
    const trimmed = bank.trim();
    if (!trimmed) {
      setPasteState("empty");
      return;
    }
    saveSavedBank(trimmed, effectiveRsn || null);
    if (effectiveRsn) saveSavedRsn(effectiveRsn);
    setPasteState("saved");
    onSaved?.(trimmed, effectiveRsn);
    window.setTimeout(onClose, 260);
  };

  const statusCopy =
    pasteState === "saved"
      ? "Bank saved. Scapestack can use it everywhere."
      : pasteState === "pasted"
        ? "Pasted from clipboard."
        : pasteState === "empty"
          ? "Paste a Bank Memory export first."
          : pasteState === "blocked"
            ? "Clipboard blocked. Paste manually below."
            : effectiveRsn
              ? `Saving this bank for ${effectiveRsn}.`
              : "No RSN selected yet. Saved on this device.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-bank-modal-title"
      className="fixed inset-0 z-[180] overflow-y-auto bg-black/72 px-4 pb-8 pt-16 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
      onClick={onClose}
    >
      <div
        className="osrs-frame w-full max-w-2xl overflow-hidden text-left shadow-[0_34px_140px_-56px_rgba(0,0,0,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow text-[var(--color-accent)]">Bank setup</p>
            <h2 id="add-bank-modal-title" className="mt-1 text-[25px] font-semibold leading-tight text-[var(--color-text)]">
              Add bank
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Paste Bank Memory once. Scapestack saves it on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add bank"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="osrs-body p-5 sm:p-6">
          <BankSetupSteps compact showBankExample />

          <label className="mt-4 block">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Bank Memory or Bank Tags
            </span>
            <textarea
              value={bank}
              onChange={(event) => setBank(event.target.value)}
              placeholder="Paste your bank here..."
              rows={7}
              spellCheck={false}
              autoFocus
              aria-describedby="add-bank-modal-status"
              className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
            />
          </label>

          <p
            id="add-bank-modal-status"
            role="status"
            aria-live="polite"
            className={cn(
              "mt-2 flex items-center gap-1.5 text-[12px] font-semibold leading-relaxed",
              pasteState === "saved" || pasteState === "pasted"
                ? "text-[var(--color-accent)]"
                : pasteState === "empty" || pasteState === "blocked"
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-text-muted)]"
            )}
          >
            {(pasteState === "saved" || pasteState === "pasted") && <CheckCircle2 className="size-3.5" />}
            {statusCopy}
          </p>
        </div>

        <div className="osrs-body flex flex-col gap-2 border-t border-[var(--color-parchment-edge)] px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="btn-ghost h-11 justify-center px-4 text-[13px] font-bold"
          >
            <ClipboardPaste className="size-4" />
            Paste
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!bank.trim()}
            className="btn-primary h-11 flex-1 justify-center px-4 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save bank
            <ArrowRight className="size-4" />
          </button>
          <Link
            href={fullOrganizerHref}
            onClick={onClose}
            className="btn-ghost h-11 justify-center px-4 text-[13px] font-bold"
          >
            Open full organizer
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
