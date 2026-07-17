"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardPaste, ExternalLink, FileUp, X } from "lucide-react";
import { BANK_MEMORY_EXAMPLE, BankSetupSteps } from "@/components/bank-setup-steps";
import { getActiveAccount } from "@/lib/account-storage";
import { loadSavedBank, loadSavedRsn, saveSavedBank, saveSavedRsn } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface AddBankModalProps {
  open: boolean;
  onClose: () => void;
  rsn?: string | null;
  initialBank?: string;
  source?: string;
  onSaved?: (bank: string, rsn: string) => void;
}

type PasteState = "idle" | "pasted" | "empty" | "blocked" | "saved";
const ANALYTICS_BANK_SOURCES = new Set(["home", "next", "header", "run-bar", "dps", "goals", "slayer", "bank"]);

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
  const [dragActive, setDragActive] = useState(false);
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
    setDragActive(false);
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
    const hadBankBeforeSave = Boolean(initialBank.trim() || loadSavedBank(effectiveRsn || null)?.banktags.trim());
    saveSavedBank(trimmed, effectiveRsn || null);
    if (effectiveRsn) saveSavedRsn(effectiveRsn);
    const analyticsSource = ANALYTICS_BANK_SOURCES.has(source)
      ? source as "home" | "next" | "header" | "run-bar" | "dps" | "goals" | "slayer" | "bank"
      : "unknown";
    track(hadBankBeforeSave ? "bank:refreshed" : "bank:attached", {
      source: analyticsSource,
      linkedToAccount: Boolean(effectiveRsn)
    });
    setPasteState("saved");
    onSaved?.(trimmed, effectiveRsn);
    window.setTimeout(onClose, 260);
  };

  const readBankFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
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

  const dropBankFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void readBankFile(event.dataTransfer.files?.[0]);
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
              : "Paste or drop your Bank Memory export.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-bank-modal-title"
      className="fixed inset-0 z-[180] flex items-end justify-center overflow-y-auto bg-black/78 p-0 backdrop-blur-sm sm:items-center sm:p-8"
      onClick={onClose}
    >
      <div
        className="scape-dialog overflow-hidden text-left"
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
            className="icon-btn shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="osrs-body p-5 sm:p-6">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/35 p-3 sm:grid-cols-[136px_minmax(0,1fr)]">
            <div className="flex min-h-[80px] items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-black p-1.5 sm:min-h-[92px]">
              <img
                src={BANK_MEMORY_EXAMPLE}
                alt="Bank Memory saved bank in RuneLite"
                className="max-h-[88px] w-full object-contain sm:max-h-[104px]"
                onError={(event) => {
                  event.currentTarget.src = "/intro/step2.png";
                }}
              />
            </div>
            <div>
              <p className="text-[12.5px] font-bold leading-snug text-[var(--color-text)] sm:text-[13.5px]">Copy item data from Bank Memory</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)] sm:text-[12px]">
                Right-click your saved bank in RuneLite, copy item data, then paste or drop the export below.
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--color-accent)] sm:mt-2 sm:text-[11.5px]">
                <CheckCircle2 className="size-3.5" />
                {effectiveRsn ? `Attaches to ${effectiveRsn}` : "Saved on this device"}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 rounded-lg border bg-[var(--color-bg)] p-2 transition-colors",
              dragActive ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)]"
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
            }}
            onDrop={dropBankFile}
          >
          <label className="block">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Bank Memory or Bank Tags
            </span>
            <textarea
              value={bank}
              onChange={(event) => setBank(event.target.value)}
              placeholder="Paste your bank here..."
              rows={4}
              spellCheck={false}
              aria-describedby="add-bank-modal-status"
              className="mt-2 w-full resize-y border-0 bg-transparent px-2 py-2 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
          </label>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-2 pt-2">
              <span className="text-[11px] text-[var(--color-text-muted)]">Drop .txt, .tsv or .csv here</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-accent)] hover:underline">
                <FileUp className="size-3.5" />
                Choose file
                <input
                  type="file"
                  accept=".txt,.tsv,.csv,text/plain,text/tab-separated-values,text/csv"
                  className="sr-only"
                  onChange={(event) => void readBankFile(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

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

          <details className="group mt-4 border-t border-[var(--color-parchment-edge)]/70 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[var(--color-text)] marker:hidden [&::-webkit-details-marker]:hidden">
              <span>How to copy your bank</span>
              <ChevronDown className="size-3.5 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <BankSetupSteps compact className="mt-3" />
          </details>
        </div>

        <div className="osrs-body border-t border-[var(--color-parchment-edge)] px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
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
          </div>
          <Link
            href={fullOrganizerHref}
            onClick={onClose}
            className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
          >
            Organize this bank instead
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
