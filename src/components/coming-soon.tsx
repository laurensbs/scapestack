"use client";

import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { getTool } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { ToolHeader } from "./tool-header";

interface ComingSoonProps {
  slug: string;
  preview?: React.ReactNode;
}

export function ComingSoon({ slug, preview }: ComingSoonProps) {
  const tool = getTool(slug);
  if (!tool) return null;

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-5 py-7 pb-20">
      <ToolHeader slug={slug} />

      <div className={cn(
        "relative overflow-hidden rounded-2xl p-8 sm:p-12 text-center",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-border)]",
        "animate-[slide-up_0.4s_ease-out]"
      )}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold-soft)]/40 to-transparent" />

        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-5",
          "bg-gradient-to-r from-[oklch(0.92_0.14_85)] to-[oklch(0.74_0.16_75)]",
          "text-[oklch(0.15_0.02_50)] text-[10px] font-bold tracking-widest uppercase",
          "shadow-[0_3px_8px_oklch(0_0_0/0.4)]"
        )}>
          <Bell className="size-3" /> Coming soon
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3 tracking-tight">
          {tool.tagline}
        </h2>
        <p className="text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-xl mx-auto mb-7">
          {tool.description}
        </p>

        {preview && (
          <div className="my-6 max-w-2xl mx-auto">
            {preview}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/bank"
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold",
              "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)]",
              "text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)]",
              "shadow-[0_3px_0_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.3)]",
              "hover:brightness-110 hover:-translate-y-px transition-all"
            )}
          >
            Try the Bank Organizer instead
          </Link>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px]",
              "bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)]",
              "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            )}
          >
            <ArrowLeft className="size-3.5" /> Back to hub
          </Link>
        </div>
      </div>
    </main>
  );
}
