"use client";

import { useState, useEffect } from "react";
import { Coffee, Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "scapestack:support-card-dismissed";
const BMC_URL = "https://www.buymeacoffee.com/laurensb";

interface Props {
  /** Optional context phrase: "Saved you a minute organizing your bank?" */
  context?: string;
}

/**
 * Success-moment support ask. Lives at the bottom of a tool's result view
 * (after a bank organize / goals scan / DPS calc) where the user just got
 * value. Dismissable for 30 days.
 */
export function SupportCard({ context = "Saved you a minute?" }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const until = parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10);
      setDismissed(until > Date.now());
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    try { localStorage.setItem(DISMISSED_KEY, String(until)); } catch {}
    setDismissed(true);
  };

  if (dismissed === null || dismissed === true) return null;

  return (
    <section className={cn(
      "relative mt-8 rounded-xl overflow-hidden",
      "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
      "border border-[var(--color-accent)]/25"
    )}>
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.4), transparent)" }}
      />
      <div
        className="absolute -top-16 -right-16 size-48 rounded-full pointer-events-none blur-3xl opacity-30"
        style={{ background: "rgba(230, 165, 47, 0.4)" }}
      />

      <div className="relative p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
          <Heart className="size-5" strokeWidth={1.75} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-text)] leading-tight">
            {context}
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
            Scapestack is a one-person side project, free to use, with no ads or accounts.
            Coffees cover hosting and buy time for the next tool. Every bit helps.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-semibold",
              "bg-[var(--color-accent)] text-[#07090C]",
              "hover:brightness-110 transition-all"
            )}
          >
            <Coffee className="size-4" />
            Buy me a coffee
          </a>
          <button
            onClick={dismiss}
            className="size-8 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors"
            title="Hide for 30 days"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Smaller variant: tucked into a tool-header as a low-key "support" pill.
 * Lives next to the Edit input / Share buttons.
 */
export function SupportPill() {
  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Support Scapestack"
      className={cn(
        "btn-ghost",
        "hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40"
      )}
    >
      <Coffee className="size-3.5" />
      <span className="hidden sm:inline">Support</span>
    </a>
  );
}
