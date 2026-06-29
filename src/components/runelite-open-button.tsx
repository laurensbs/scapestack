"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const PLUGIN_SEARCH = "Scapestack Sync";

export function RuneliteOpenButton({ className }: { className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const openRunelite = async () => {
    const result = await copyText(PLUGIN_SEARCH);
    setState(result === "failed" ? "error" : "copied");
    window.setTimeout(() => setState("idle"), 1800);
    try {
      window.location.href = "runelite://";
    } catch {
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={openRunelite}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110"
        aria-label="Open RuneLite and copy Scapestack Sync plugin search"
      >
        <ExternalLink className="size-4" />
        Open RuneLite
      </button>
      <span role="status" aria-live="polite" className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        {state === "copied"
          ? "Copied “Scapestack Sync”. Paste it in Plugin Hub search."
          : state === "error"
            ? "Search Plugin Hub for Scapestack Sync."
            : (
              <span className="inline-flex items-center gap-1">
                <Copy className="size-3" />
                Copies plugin name for Plugin Hub search
              </span>
            )}
      </span>
    </div>
  );
}
