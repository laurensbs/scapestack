"use client";

import { useMemo } from "react";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { BOSSES } from "@/lib/bosses";
import { ownedGear } from "@/lib/gear";
import type { PlannerAccountType } from "@/lib/account-type";
import {
  organizedItemsFromHandoff,
  type BankHandoffItem
} from "@/lib/next-bank-handoff";

interface Props {
  bossSlug: string;
  bankItems?: BankHandoffItem[];
  onClose: () => void;
  onSelectBoss?: (bossSlug: string) => void;
  analyticsSource?: "next" | "check_kill";
  accountType?: PlannerAccountType | null;
}

export default function LazyBossDetailModal({
  bossSlug,
  bankItems = [],
  onClose,
  onSelectBoss,
  analyticsSource = "next",
  accountType = null
}: Props) {
  const boss = useMemo(
    () => BOSSES.find((candidate) => candidate.slug === bossSlug) ?? null,
    [bossSlug]
  );
  const owned = useMemo(
    () => ownedGear(organizedItemsFromHandoff(bankItems)),
    [bankItems]
  );

  if (!boss) return null;

  return (
    <BossDetailModal
      boss={boss}
      owned={owned}
      bankItems={bankItems}
      accountType={accountType}
      analyticsSource={analyticsSource}
      onSelectBoss={(nextBoss) => onSelectBoss?.(nextBoss.slug)}
      onClose={onClose}
    />
  );
}
