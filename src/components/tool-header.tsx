"use client";

import { getTool } from "@/lib/tools";

interface ToolHeaderProps {
  slug: string;
  /** Extra action buttons rendered on the tool header. */
  actions?: React.ReactNode;
}

export function ToolHeader({ slug, actions }: ToolHeaderProps) {
  const tool = getTool(slug);
  if (!tool) return null;
  const Icon = tool.icon;
  return (
    <header className="scape-page-intro">
      <div className="scape-page-intro__identity">
        <span className="scape-page-intro__icon" aria-hidden="true">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
            <h1 className="text-[var(--color-text)]">
              {tool.name}
            </h1>
            <p>{tool.tagline}</p>
        </div>
      </div>
      {actions ? <div className="scape-page-intro__actions flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
