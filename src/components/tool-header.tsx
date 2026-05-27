"use client";

import { getTool } from "@/lib/tools";
import { SupportPill } from "./support-card";

interface ToolHeaderProps {
  slug: string;
  /** Extra action buttons rendered before the persistent Support pill. */
  actions?: React.ReactNode;
}

export function ToolHeader({ slug, actions }: ToolHeaderProps) {
  const tool = getTool(slug);
  if (!tool) return null;
  const Icon = tool.icon;
  return (
    // Premium tool-header: accent top-line + ruimere typografie + iets
    // soeverein-laagje gradient op de icon-tile. Geen separator-border
    // onderaan meer; de hero-card daaronder doet de visuele scheiding.
    <header className="relative mb-6 sm:mb-8">
      {/* Accent top-line zoals headline-card + hero-strip gebruiken —
          bindt alle tools visueel aan elkaar. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(230,165,47,0.45), transparent)" }}
      />
      <div className="flex items-center justify-between gap-4 pt-5">
        <div className="flex items-center gap-3.5">
          {/* Icon tile: gradient + accent border zodat hij actief voelt
              ipv "tile met icoon". */}
          <div className="relative size-11 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border border-[var(--color-accent)]/30 text-[var(--color-accent)] shadow-[0_0_18px_-8px_rgba(230,165,47,0.5)]">
            <Icon className="size-[22px]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--color-text)] leading-tight tracking-tight">
              {tool.name}
            </h1>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{tool.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <SupportPill />
        </div>
      </div>
    </header>
  );
}
