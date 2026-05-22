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
    <header className="flex items-end justify-between gap-4 mb-8 pb-5 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-3.5">
        <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-accent)]">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--color-text)] leading-tight tracking-tight">
            {tool.name}
          </h1>
          <p className="text-[12.5px] text-[var(--color-text-dim)] mt-1">{tool.tagline}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <SupportPill />
      </div>
    </header>
  );
}
