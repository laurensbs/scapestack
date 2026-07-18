"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, PlugZap } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const PLUGIN_SEARCH = "Scapestack Sync";
const RUNELITE_PROTOCOL_URL = "runelite://";
const RUNELITE_PLUGIN_HUB_URL = "https://runelite.net/plugin-hub/show/scapestack-sync";

export function RuneliteOpenButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "opening" | "copied" | "error">("idle");

  const openRunelite = async () => {
    const result = await copyText(PLUGIN_SEARCH);
    if (result === "failed") {
      setState("error");
    } else {
      setState("opening");
      window.setTimeout(() => {
        setState((current) => current === "opening" ? "copied" : current);
      }, 650);
    }
    window.setTimeout(() => setState("idle"), 6200);
    try {
      window.location.href = RUNELITE_PROTOCOL_URL;
    } catch {
      setState("error");
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <button
        type="button"
        onClick={openRunelite}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110",
          compact && "w-full"
        )}
        aria-label="Open RuneLite and copy Scapestack Sync plugin search"
      >
        <PlugZap className="size-4" />
        Open RuneLite
      </button>
      <div className={cn(
        "flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]",
        compact && state === "idle" && "sr-only"
      )}>
        <span role="status" aria-live="polite" className="inline-flex min-w-0 items-center gap-1">
          {state === "opening" ? (
            <>
              <ExternalLink className="size-3" />
              Opening RuneLite. Plugin name copied.
            </>
          ) : state === "copied" ? (
            <>
              <CheckCircle2 className="size-3 text-[var(--color-good)]" />
              Copied. Search RuneLite for Scapestack Sync.
            </>
          ) : state === "error" ? (
            "Open RuneLite, search for Scapestack Sync."
          ) : (
            <>
              <Copy className="size-3" />
              Copies plugin name, then opens RuneLite.
            </>
          )}
        </span>
        <a
          href={RUNELITE_PLUGIN_HUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-[var(--color-text-dim)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-accent)]"
        >
          RuneLite page
        </a>
      </div>
    </div>
  );
}
