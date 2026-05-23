"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ClipboardPaste, Trash2, ArrowRight, Loader2, User, Sparkles, Filter, Check } from "lucide-react";
import { cn, SAMPLE_BANKTAGS, ICON_URL } from "@/lib/utils";
import { loadStoredRsn, saveStoredRsn } from "@/lib/archetype";

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
  // Fired as the user fills the flow in: false → empty box, true → a valid
  // bank is pasted. The parent uses this to advance the Intro's step rail.
  onPasteStateChange?: (pasted: boolean) => void;
}

export function Intake({ onSubmit, loading, error, askRsn = false, onPasteStateChange }: IntakeProps) {
  const [value, setValue] = useState("");
  const [restored, setRestored] = useState(false);
  const [junkFilter, setJunkFilter] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rsn, setRsn] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Restore last input + RSN on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setValue(saved);
        setRestored(true);
      }
    } catch { /* localStorage blocked — fine */ }
    const storedRsn = loadStoredRsn();
    if (storedRsn) setRsn(storedRsn);
  }, []);

  const kind = detectKind(value);
  const hint = kind ? HINTS[kind] : null;
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(tsv|txt|csv)$/i.test(file.name) && !/^text\//.test(file.type || "")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").trim();
      setValue(text);
      setRestored(false);
    };
    reader.readAsText(file);
  };

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text.trim());
        setRestored(false);
        taRef.current?.focus();
      }
    } catch {
      // Clipboard read denied — user has to ⌘V manually.
    }
  };

  const onClear = () => {
    setValue("");
    setRestored(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    taRef.current?.focus();
  };

  const loadSample = () => {
    setValue(SAMPLE_BANKTAGS);
    setRestored(false);
    taRef.current?.focus();
  };

  // Empty-state preview: show 6 mock sprite slots when textarea is empty.
  const showEmptyState = !value.trim();
  const PREVIEW_IDS = [4151, 11802, 11806, 4712, 5616, 12791];

  return (
    <section className="surface p-6 animate-[slide-up_0.4s_ease-out_0.15s_both]">
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
            <h2 className="text-[15px] font-semibold text-[var(--color-text)] tracking-tight leading-tight">
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
                <img
                  src={ICON_URL(id)}
                  alt=""
                  className="pixelated"
                  loading="lazy"
                  decoding="async"
                  style={{ maxWidth: "78%", maxHeight: "78%", width: "auto", height: "auto", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
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
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setRestored(false); }}
          rows={6}
          className={cn(
            "w-full rounded-lg px-4 py-3.5 font-mono text-[12.5px] leading-relaxed",
            "bg-[var(--color-bg-2)] border border-[var(--color-border)]",
            "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(230, 165, 47,0.12)]",
            "placeholder:text-[var(--color-text-muted)]",
            "resize-y min-h-[140px]"
          )}
          placeholder={`Paste either:\n\nbanktags,1,mybank,4151,1213,995,...\n\nor a Bank Memory TSV:\nItem id\tItem name\tItem quantity\n4151\tAbyssal whip\t1\n995\tCoins\t12345`}
        />
        {dragOver && (
          <div className="absolute inset-0 rounded-lg bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)] flex items-center justify-center pointer-events-none animate-[pop-in_0.18s_ease-out]">
            <div className="bg-[var(--color-panel)] border border-[var(--color-accent)] px-4 py-2 rounded-md text-[var(--color-accent)] font-medium text-[13px]">
              Drop your .tsv or .txt
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPaste} className="btn-ghost">
          <ClipboardPaste className="size-3.5" /> Paste
        </button>
        <button
          type="button"
          onClick={onClear}
          className="btn-ghost hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40"
        >
          <Trash2 className="size-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={() => setJunkFilter(!junkFilter)}
          aria-pressed={junkFilter}
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
              <h3 className="text-[14px] font-semibold text-[var(--color-text)] tracking-tight leading-tight flex items-center gap-2">
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
            <input
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              maxLength={12}
              placeholder="e.g. Lynx Titan"
              className={cn(
                "w-full rounded-md pl-9 pr-3 py-2.5 text-[13px] font-mono",
                "bg-[var(--color-panel)] border border-[var(--color-border)]",
                "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(230, 165, 47,0.12)]",
                "placeholder:text-[var(--color-text-muted)]"
              )}
            />
          </div>
          <p className="mt-2.5 text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">
            We check your hiscores once to spot a maxed main, PvMer, skiller or ironman —
            so the layout fits how you actually play. Leave it blank for a balanced default.
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={submit}
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

        {error && (
          <span className="text-[var(--color-danger)] text-[13px] animate-[pop-in_0.18s_ease-out]">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
