"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ClipboardPaste, Trash2, ArrowRight, Loader2, User, Sparkles, Filter, Check, Upload } from "lucide-react";
import { cn, SAMPLE_BANKTAGS } from "@/lib/utils";
import { loadStoredRsn, saveStoredRsn } from "@/lib/archetype";
import { ItemSprite } from "@/components/item-sprite";

const STORAGE_KEY = "osrs-bank-organizer:last-input";

type InputKind = "banktags" | "bankMemory" | "ids" | "unknown" | null;

function detectKind(s: string): InputKind {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (t.startsWith("banktags,")) return "banktags";
  const firstLine = t.split(/\r?\n/, 1)[0].toLowerCase();
  if (firstLine.includes("\t") && firstLine.includes("item id")) return "bankMemory";
  if (/^[\d,\s-]+$/.test(t)) return "ids";
  return "unknown";
}

function summarizeInput(value: string, kind: InputKind): { label: string; detail: string } | null {
  const text = value.trim();
  if (!text || !kind || kind === "unknown") return null;

  if (kind === "banktags") {
    const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
    const itemCount = Math.max(0, parts.length - 3);
    return {
      label: "Bank Tags detected",
      detail: `${itemCount.toLocaleString()} item IDs · layout exact · quantities unavailable`
    };
  }

  if (kind === "bankMemory") {
    const rows = text.split(/\r?\n/).filter((line) => line.trim()).slice(1);
    return {
      label: "Bank Memory detected",
      detail: `${rows.length.toLocaleString()} item rows · quantities active · value sorting enabled`
    };
  }

  const itemCount = text.split(/[,\s]+/).filter(Boolean).length;
  return {
    label: "Raw item IDs detected",
    detail: `${itemCount.toLocaleString()} item IDs · layout works · names and quantities inferred where possible`
  };
}

function cleanRsn(input: string | null | undefined): string {
  return (input ?? "").trim().slice(0, 12);
}

function rsnFromCurrentUrl(): string {
  if (typeof window === "undefined") return "";
  return cleanRsn(new URLSearchParams(window.location.search).get("rsn"));
}

const HINTS: Record<NonNullable<InputKind>, { msg: string; tone: "good" | "neutral" | "bad" }> = {
  banktags: { msg: "Bank Tags string — no quantities, but layout still works", tone: "neutral" },
  bankMemory: { msg: "Bank Memory TSV — includes quantities, smart sort enabled", tone: "good" },
  ids: { msg: "Raw item ID list — no quantities or names", tone: "neutral" },
  unknown: { msg: "Unrecognized format — paste a Bank Tags string or Bank Memory TSV", tone: "bad" }
};

interface IntakeProps {
  onSubmit: (input: string, junkFilter: boolean, rsn: string) => void;
  loading: boolean;
  error: string | null;
  askRsn?: boolean;
  initialRsn?: string;
  // Fired as the user fills the flow in: false → empty box, true → a valid
  // bank is pasted. The parent uses this to advance the Intro's step rail.
  onPasteStateChange?: (pasted: boolean) => void;
}

export function Intake({ onSubmit, loading, error, askRsn = false, initialRsn = "", onPasteStateChange }: IntakeProps) {
  const [value, setValue] = useState("");
  const [restored, setRestored] = useState(false);
  const [junkFilter, setJunkFilter] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clipboardState, setClipboardState] = useState<"idle" | "pasted" | "empty" | "blocked">("idle");
  const [fileImportState, setFileImportState] = useState<"idle" | "loaded" | "unsupported">("idle");
  const cleanInitialRsn = cleanRsn(initialRsn);
  const [rsn, setRsn] = useState(cleanInitialRsn);
  const [handoffRsn, setHandoffRsn] = useState(cleanInitialRsn);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore last input + RSN on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setValue(saved);
        setRestored(true);
      }
    } catch { /* localStorage blocked — fine */ }
    const urlRsn = cleanInitialRsn || rsnFromCurrentUrl();
    if (urlRsn) {
      setRsn(urlRsn);
      setHandoffRsn(urlRsn);
      saveStoredRsn(urlRsn);
      return;
    }
    const storedRsn = loadStoredRsn();
    if (storedRsn) setRsn(storedRsn);
  }, [cleanInitialRsn]);

  const kind = detectKind(value);
  const hint = kind ? HINTS[kind] : null;
  const inputSummary = summarizeInput(value, kind);
  // Step 3 counts as "done" once a recognisable bank format is in the box.
  // This flips the badge to a checkmark and lets step 4 light up as current,
  // so the flow visibly advances as the user fills it in.
  const pasteDone = !!value.trim() && kind !== "unknown" && kind !== null;

  // Bubble paste-progress up so the Intro rail can auto-advance. Only a
  // *fresh* paste counts — a value silently restored from localStorage on
  // mount must NOT jump the rail to step 3; the user should still start at
  // step 1. `restored` is cleared by every real edit (type/paste/drop).
  useEffect(() => {
    onPasteStateChange?.(pasteDone && !restored);
  }, [pasteDone, restored, onPasteStateChange]);

  const submit = useCallback(() => {
    if (!value.trim()) return;
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
    const cleanedRsn = rsn.trim();
    if (cleanedRsn) saveStoredRsn(cleanedRsn);
    onSubmit(value, junkFilter, cleanedRsn);
  }, [value, junkFilter, rsn, onSubmit]);

  // ⌘/Ctrl + Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && document.activeElement === taRef.current) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submit]);

  const readBankFile = (file: File) => {
    if (!/\.(tsv|txt|csv)$/i.test(file.name) && !/^text\//.test(file.type || "")) {
      setFileImportState("unsupported");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").trim();
      setValue(text);
      setRestored(false);
      setClipboardState("idle");
      setFileImportState("loaded");
      taRef.current?.focus();
    };
    reader.onerror = () => setFileImportState("unsupported");
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readBankFile(file);
  };

  const onChooseFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) readBankFile(file);
    e.currentTarget.value = "";
  };

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text.trim());
        setRestored(false);
        setClipboardState("pasted");
        setFileImportState("idle");
        taRef.current?.focus();
      } else {
        setClipboardState("empty");
        setFileImportState("idle");
        taRef.current?.focus();
      }
    } catch {
      setClipboardState("blocked");
      setFileImportState("idle");
      taRef.current?.focus();
    }
  };

  const onClear = () => {
    setValue("");
    setRestored(false);
    setClipboardState("idle");
    setFileImportState("idle");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    taRef.current?.focus();
  };

  const loadSample = () => {
    setValue(SAMPLE_BANKTAGS);
    setRestored(false);
    setClipboardState("idle");
    setFileImportState("idle");
    taRef.current?.focus();
  };

  // Empty-state preview: show 6 mock sprite slots when textarea is empty.
  const showEmptyState = !value.trim();
  const PREVIEW_IDS = [4151, 11802, 11806, 4712, 5616, 12791];

  return (
    <section id="bank-paste-panel" data-testid="bank-paste-panel" className="surface p-6 animate-[slide-up_0.4s_ease-out_0.15s_both]">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-7 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 transition-all duration-200",
              pasteDone
                ? "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]"
                : "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]"
            )}
          >
            {pasteDone ? <Check className="size-3.5" strokeWidth={3} /> : "3"}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-text)] tracking-normal leading-tight">
              Paste or drop your bank
            </h2>
            <p className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
              {pasteDone ? "Bank detected — review the OSRS name below, then organize" : "Step 3 of 4 — drop the export from RuneLite here"}
            </p>
          </div>
        </div>
        {showEmptyState && (
          <button
            type="button"
            onClick={loadSample}
            aria-label="Load sample bank into the paste box"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium",
              "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border border-[var(--color-accent)]/30",
              "hover:bg-[var(--color-accent)]/18 hover:scale-[1.02] transition-all",
              "animate-[pop-in_0.2s_ease-out]"
            )}
            title="Load a demo bank so you can see what comes out"
          >
            <Sparkles className="size-3.5" />
            Try with sample bank
          </button>
        )}
      </div>

      {showEmptyState && (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/50 px-4 py-3 flex items-center gap-3 animate-[fade-in_0.3s_ease-out]">
          <div className="flex -space-x-2">
            {PREVIEW_IDS.map((id, i) => (
              <div
                key={id}
                className="size-9 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center shadow-[0_2px_8px_-2px_rgb(0_0_0/0.6)]"
                style={{ zIndex: PREVIEW_IDS.length - i, animation: `pop-in 0.25s ease-out ${i * 0.04}s both` }}
              >
                <ItemSprite
                  id={id}
                  alt=""
                  className="pixelated"
                  loading="lazy"
                  style={{ maxWidth: "78%", maxHeight: "78%", width: "auto", height: "auto" }}
                />
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-[var(--color-text)] leading-tight">
              <span className="font-semibold">No bank yet?</span> Try the sample to see how your bank would look — organized into 9 tabs, sorted by class, with stack values.
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Or follow the steps above to grab your real one from RuneLite.
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative rounded-lg transition-all",
          dragOver && "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-transparent"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <label htmlFor="bank-paste-input" className="sr-only">
          Paste RuneLite Bank Memory, Bank Tags or item IDs
        </label>
        <textarea
          id="bank-paste-input"
          data-testid="bank-paste-input"
          name="bank-export"
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setRestored(false); setClipboardState("idle"); setFileImportState("idle"); }}
          rows={6}
          spellCheck={false}
          aria-describedby="bank-paste-help bank-paste-status"
          className={cn(
            "w-full rounded-lg px-4 py-3.5 font-mono text-[12.5px] leading-relaxed",
            "bg-[var(--color-bg-2)] border border-[var(--color-border)]",
            "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(31, 182, 166,0.12)]",
            "placeholder:text-[var(--color-text-muted)]",
            "resize-y min-h-[140px]"
          )}
          placeholder={`Paste either:\n\nbanktags,1,mybank,4151,1213,995,...\n\nor a Bank Memory TSV:\nItem id\tItem name\tItem quantity\n4151\tAbyssal whip\t1\n995\tCoins\t12345`}
        />
        <p id="bank-paste-help" className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
          Browser-only paste. Bank Memory gives quantities and GP value; Bank Tags gives exact item IDs and layout.
        </p>
        <p id="bank-paste-status" role="status" aria-live="polite" className="sr-only">
          {inputSummary
            ? `${inputSummary.label}. ${inputSummary.detail}.`
            : hint
              ? hint.msg
              : "No bank export detected yet."}
        </p>
        {dragOver && (
          <div className="absolute inset-0 rounded-lg bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)] flex items-center justify-center pointer-events-none animate-[pop-in_0.18s_ease-out]">
            <div className="bg-[var(--color-panel)] border border-[var(--color-accent)] px-4 py-2 rounded-md text-[var(--color-accent)] font-medium text-[13px]">
              Drop your .tsv or .txt
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id="bank-file-input"
          ref={fileInputRef}
          type="file"
          accept=".tsv,.txt,.csv,text/plain,text/tab-separated-values,text/csv"
          className="sr-only"
          aria-describedby="bank-paste-help"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onChooseFile}
          aria-label="Choose a Bank Memory, Bank Tags or item ID file"
          className="btn-ghost"
        >
          <Upload className="size-3.5" /> Choose file
        </button>
        <button type="button" onClick={onPaste} aria-label="Paste bank export from clipboard" className="btn-ghost">
          <ClipboardPaste className="size-3.5" /> Paste
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear pasted bank export"
          className="btn-ghost hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40"
        >
          <Trash2 className="size-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={() => setJunkFilter(!junkFilter)}
          aria-pressed={junkFilter}
          aria-label={junkFilter ? "Disable junk filter" : "Enable junk filter"}
          title="Hide low-value single-stack items (under 25 gp, no equip slot, no high-alch)"
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all border",
            junkFilter
              ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/35 hover:bg-[var(--color-accent)]/18"
              : "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          )}
        >
          <span
            className={cn(
              "inline-flex items-center justify-center size-3.5 rounded-[4px] border transition-colors",
              junkFilter
                ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                : "bg-[var(--color-bg-2)] border-[var(--color-border)]"
            )}
          >
            {junkFilter && <Check className="size-2.5 text-[var(--color-bg)]" strokeWidth={3.5} />}
          </span>
          <Filter className="size-3.5" />
          Junk filter
        </button>
      </div>

      {clipboardState !== "idle" && (
        <p
          aria-live="polite"
          className={cn(
            "mt-2 text-[12px] animate-[pop-in_0.18s_ease-out]",
            clipboardState === "pasted" && "text-[var(--color-accent)]",
            clipboardState !== "pasted" && "text-[var(--color-text-dim)]"
          )}
        >
          {clipboardState === "pasted" && "Pasted from clipboard."}
          {clipboardState === "empty" && "Clipboard was empty — copy Bank Memory or Bank Tags first."}
          {clipboardState === "blocked" && "Clipboard blocked — click the box and press ⌘V or Ctrl+V manually."}
        </p>
      )}

      {fileImportState !== "idle" && (
        <p
          aria-live="polite"
          className={cn(
            "mt-2 text-[12px] animate-[pop-in_0.18s_ease-out]",
            fileImportState === "loaded" && "text-[var(--color-accent)]",
            fileImportState === "unsupported" && "text-[var(--color-danger)]"
          )}
        >
          {fileImportState === "loaded" && "File loaded — review the detected format before organizing."}
          {fileImportState === "unsupported" && "Unsupported file — choose a .tsv, .txt or .csv bank export."}
        </p>
      )}

      {hint && (
        <p className={cn(
          "mt-3 text-[12px] flex items-center gap-2 animate-[pop-in_0.18s_ease-out]",
          hint.tone === "good" && "text-[var(--color-accent)]",
          hint.tone === "neutral" && "text-[var(--color-text-dim)]",
          hint.tone === "bad" && "text-[var(--color-danger)]"
        )}>
          <span className="size-1.5 rounded-full bg-current" /> {hint.msg}
        </p>
      )}

      {inputSummary && (
        <div
          data-testid="bank-input-summary"
          className="mt-3 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3.5 py-3 animate-[pop-in_0.18s_ease-out]"
        >
          <p className="text-[12.5px] font-semibold text-[var(--color-text)]">{inputSummary.label}</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-text-dim)]">{inputSummary.detail}</p>
        </div>
      )}

      {restored && (
        <p className="mt-2 text-[12px] text-[var(--color-text-muted)] italic">
          Restored your last paste — hit Organize, or Clear to start fresh.
        </p>
      )}

      {askRsn && (
        <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                "size-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 transition-all duration-200",
                pasteDone
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]"
                  : "bg-[var(--color-bg-2)] text-[var(--color-text-dim)] border-[var(--color-border)]"
              )}
            >
              4
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)] tracking-normal leading-tight flex items-center gap-2">
                Your OSRS name
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold tracking-wider uppercase bg-[var(--color-panel-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  Optional
                </span>
              </h3>
              <p className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
                Step 4 of 4 — tailors the tab layout to your account
              </p>
            </div>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-accent)] pointer-events-none" />
            <label htmlFor="bank-rsn-input" className="sr-only">
              OSRS name for bank layout personalization
            </label>
            <input
              id="bank-rsn-input"
              name="rsn"
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              maxLength={12}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="bank-rsn-help"
              placeholder="e.g. Lynx Titan"
              className={cn(
                "w-full rounded-md pl-9 pr-3 py-2.5 text-[13px] font-mono",
                "bg-[var(--color-panel)] border border-[var(--color-border)]",
                "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(31, 182, 166,0.12)]",
                "placeholder:text-[var(--color-text-muted)]"
              )}
            />
          </div>
          <p id="bank-rsn-help" className="mt-2.5 text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">
            We check your hiscores once to spot a maxed main, PvMer, skiller or ironman —
            so the layout fits how you actually play. Leave it blank for a balanced default.
          </p>
          {handoffRsn && (
            <p className="mt-2 text-[11.5px] font-medium text-[var(--color-accent)]">
              RSN overgenomen uit je vorige Scapestack stap.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-4 flex-wrap">
        <button
          id="bank-organize-button"
          data-testid="bank-organize-button"
          type="button"
          onClick={submit}
          aria-describedby="bank-organize-disabled-help"
          aria-label={
            loading
              ? "Organizing pasted bank"
              : value.trim()
                ? "Organize pasted bank into RuneLite-ready tabs"
                : "Paste a bank export before organizing"
          }
          disabled={!value.trim() || loading}
          className={cn(
            "btn-primary group",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Organizing…
            </>
          ) : (
            <>
              Organize
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              <span className="ml-1 text-[10px] font-mono opacity-60 bg-black/15 px-1.5 py-0.5 rounded">⌘↵</span>
            </>
          )}
        </button>
        <span
          id="bank-organize-disabled-help"
          aria-live="polite"
          className="text-[12px] leading-relaxed text-[var(--color-text-muted)]"
        >
          {!value.trim()
            ? "Paste a Bank Memory export, Bank Tags string or item IDs to unlock Organize."
            : loading
            ? "Organizing your bank into OSRS-ready tabs…"
            : "Ready to organize."}
        </span>

        {error && (
          <span className="text-[var(--color-danger)] text-[13px] animate-[pop-in_0.18s_ease-out]">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
