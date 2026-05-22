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
          "text-[var(--color-text-dim)] hover:text-[oklch(0.25_0.05_60)]",
          "hover:bg-gradient-to-b hover:from-[oklch(0.92_0.14_85)] hover:to-[oklch(0.74_0.16_75)]",
          "hover:shadow-[0_3px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
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
          "group inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold",
          "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.74_0.16_75)]",
          "text-[oklch(0.2_0.04_55)] border border-[oklch(0.46_0.13_60)]",
          "shadow-[0_2px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
          "hover:-translate-y-px hover:brightness-110 active:translate-y-0 transition-all",
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
        "group inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-[14px] font-bold tracking-wide",
        "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.74_0.16_75)]",
        "text-[oklch(0.2_0.04_55)] border-2 border-[oklch(0.46_0.13_60)]",
        "shadow-[0_4px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
        "hover:brightness-110 hover:-translate-y-px",
        "active:translate-y-0.5 active:shadow-[0_2px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
        "transition-all relative overflow-hidden",
        className
      )}
    >
      <Coffee className="size-5 group-hover:rotate-[-8deg] transition-transform" strokeWidth={2.5} />
      <span>Buy me a coffee</span>
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
    </a>
  );
}
