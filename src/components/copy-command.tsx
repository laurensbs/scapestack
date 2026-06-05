"use client";

import { useState } from "react";
import { AlertTriangle, CheckCheck, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";

interface CopyCommandProps {
  value: string;
  label?: string;
}

export function CopyCommand({ value, label = "Copy" }: CopyCommandProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const longValue = value.length > 120 || value.includes("\n");

  const copy = async () => {
    const result = await copyText(value);
    if (result !== "failed") {
      setState("copied");
      setTimeout(() => setState((current) => current === "copied" ? "idle" : current), 1600);
    } else {
      setState("error");
    }
  };

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border bg-[var(--color-bg)]",
        state === "copied" && "border-[var(--color-good)]/35",
        state === "error" && "border-[var(--color-danger)]/35",
        state === "idle" && "border-[var(--color-border)]"
      )}
    >
      <div className={cn(
        longValue
          ? "grid grid-cols-1"
          : "grid grid-cols-[minmax(0,1fr)_auto]"
      )}>
        <code className={cn(
          "min-w-0 px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--color-accent)]",
          longValue
            ? "max-h-44 overflow-auto whitespace-pre-wrap break-words border-b border-[var(--color-border)]"
            : "break-all"
        )}>
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "shrink-0 text-[11.5px] font-semibold transition-colors",
            "inline-flex items-center gap-1.5",
            longValue ? "m-2 w-fit rounded-md border px-3 py-2" : "border-l px-3",
            state === "copied" && "border-[var(--color-good)]/35 text-[var(--color-good)] bg-[var(--color-good)]/10",
            state === "error" && "border-[var(--color-danger)]/35 text-[var(--color-danger)] bg-[var(--color-danger)]/10",
            state === "idle" && "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel)]/55"
          )}
          aria-label={longValue ? label : `${label}: ${value}`}
        >
          {state === "copied" ? <CheckCheck className="size-3.5" /> : state === "error" ? <AlertTriangle className="size-3.5" /> : <Copy className="size-3.5" />}
          {state === "copied" ? "Copied" : state === "error" ? "Failed" : label}
        </button>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied command to clipboard." : state === "error" ? "Clipboard failed. Select and copy the command manually." : ""}
      </div>
      {state === "error" && (
        <p className="border-t border-[var(--color-danger)]/25 px-3 py-2 text-[11px] font-semibold text-[var(--color-danger)]">
          Clipboard failed — select the value and copy it manually.
        </p>
      )}
    </div>
  );
}
