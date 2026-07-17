"use client";

import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface BMCProps {
  variant?: "button" | "compact" | "icon";
  className?: string;
}

export function BuyMeCoffee({ variant = "button", className }: BMCProps) {
  const url = "https://www.buymeacoffee.com/laurensb";

  if (variant === "icon") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Support Scapestack with a coffee"
        className={cn(
          "group flex items-center justify-center size-10 rounded-lg transition-all",
          "text-[var(--color-text-dim)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)]",
          className
        )}
      >
        <Coffee className="size-4 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold",
          "border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]",
          "hover:brightness-110 transition-colors",
          className
        )}
      >
        <Coffee className="size-3.5 group-hover:rotate-[-8deg] transition-transform" strokeWidth={2.5} />
        Support
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg px-5 py-3 text-[14px] font-bold tracking-wide",
        "border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]",
        "hover:brightness-110 transition-colors",
        className
      )}
    >
      <Coffee className="size-5 group-hover:rotate-[-8deg] transition-transform" strokeWidth={2.5} />
      <span>Buy me a coffee</span>
    </a>
  );
}
