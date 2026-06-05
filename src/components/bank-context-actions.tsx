"use client";

import Link from "next/link";
import { ArrowRight, Plug, Shield, Sword, Target, Trophy, type LucideIcon } from "lucide-react";
import { toolHandoffUrl, type BankToolPath } from "@/lib/bank-tool-routes";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { cn } from "@/lib/utils";

export type BankContextSource = "next" | "dps" | "goals" | "slayer";
type BankContextToolId = BankContextSource | "plugin";

export interface BankContextAction {
  id: "bank" | BankContextToolId;
  href: string;
  label: string;
  primary: boolean;
}

interface BankContextActionsProps {
  hasBankContext?: boolean;
  rsn?: string | null;
  source: BankContextSource;
  className?: string;
}

const secondaryClass = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]";
const primaryClass = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15";

const toolActions: Array<Omit<BankContextAction, "href"> & { id: BankContextToolId; path: BankToolPath }> = [
  {
    id: "next",
    path: "/next",
    label: "Plan next",
    primary: true
  },
  {
    id: "dps",
    path: "/dps",
    label: "DPS",
    primary: false
  },
  {
    id: "goals",
    path: "/goals",
    label: "Goals",
    primary: false
  },
  {
    id: "slayer",
    path: "/slayer",
    label: "Slayer",
    primary: false
  },
  {
    id: "plugin",
    path: "/plugin",
    label: "Verify sync",
    primary: false
  }
];

const actionIcons: Record<BankContextAction["id"], LucideIcon> = {
  bank: Trophy,
  next: ArrowRight,
  dps: Sword,
  goals: Target,
  slayer: Shield,
  plugin: Plug
};

export function getBankContextActions(
  source: BankContextSource,
  context: { hasBankContext?: boolean; rsn?: string | null } = {}
): BankContextAction[] {
  return [
    {
      id: "bank",
      href: bankOrganizerHref(context.rsn, source),
      label: "Review bank",
      primary: false
    },
    ...toolActions
      .filter((tool) => tool.id !== source)
      .map((tool) => ({
        id: tool.id,
        href: toolHandoffUrl(tool.path, source, context.rsn, {
          hasBankContext: context.hasBankContext
        }),
        label: tool.label,
        primary: tool.primary
      }))
  ];
}

export function BankContextActions({
  hasBankContext,
  rsn,
  source,
  className
}: BankContextActionsProps) {
  const actions = getBankContextActions(source, { hasBankContext, rsn });

  return (
    <div className={cn("flex shrink-0 flex-wrap gap-2", className)}>
      {actions.map((action) => {
        const Icon = actionIcons[action.id];
        return (
          <Link
            key={action.id}
            href={action.href}
            className={action.primary ? primaryClass : secondaryClass}
          >
            {action.label}
            <Icon className="size-3.5" />
          </Link>
        );
      })}
    </div>
  );
}
