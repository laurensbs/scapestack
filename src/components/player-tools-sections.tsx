"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MoneyMethodsPanel } from "@/components/money-methods-panel";
import { PlayerBossesSection } from "@/components/player-bosses-section";
import { PlayerSetsSection } from "@/components/player-sets-section";
import { PlayerTaskSection } from "@/components/player-task-section";
import { PlayerToolNav } from "@/components/player-tool-nav";
import {
  buildAffordabilityReport,
  tradeableIndex,
  type AffordabilityReport
} from "@/lib/bank-affordability";
import { BOSSES, isNonCombatBossActivity } from "@/lib/bosses";
import { bossViabilityFromSimpleBank, type BossViability } from "@/lib/boss-viability";
import { combatStatsFromSkills } from "@/lib/dps";
import { localBankItemsFromPaste } from "@/lib/local-bank-items";
import { buildMoneyMethodFilter, type MoneyMethodFilterReport } from "@/lib/money-methods";
import { loadSavedBank } from "@/lib/saved-bank";
import type { SlayerTaskDecision } from "@/lib/slayer-task-decision";
import { parseLatestPrices, parseWikiMapping } from "@/lib/wiki";

const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";

interface LocalAnswers {
  bosses: BossViability[];
  sets: AffordabilityReport;
  money: MoneyMethodFilterReport;
}

type LocalState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; answers: LocalAnswers }
  | { kind: "error" };

export function PlayerToolsSections({
  rsn,
  skills,
  questsCompleted,
  cannotBuy,
  bosses,
  sets,
  task,
  emptyTaskReason,
  money
}: {
  rsn: string;
  skills: ReadonlyArray<{ name: string; level: number }>;
  questsCompleted: readonly string[];
  cannotBuy: boolean;
  bosses: readonly BossViability[] | null;
  sets: AffordabilityReport | null;
  task: SlayerTaskDecision | null;
  emptyTaskReason: string;
  money: MoneyMethodFilterReport | null;
}) {
  const hasSyncedBankAnswers = bosses !== null && sets !== null && money !== null;
  const [localState, setLocalState] = useState<LocalState>({ kind: "idle" });

  useEffect(() => {
    if (hasSyncedBankAnswers) return;
    const saved = loadSavedBank(rsn);
    if (!saved) return;
    let cancelled = false;
    setLocalState({ kind: "loading" });

    void Promise.all([
      fetch(LATEST_URL, { headers: { accept: "application/json" } })
        .then(async (response) => response.ok
          ? await response.json() as { data?: Record<string, Record<string, unknown>> }
          : { data: {} })
        .catch(() => ({ data: {} })),
      fetch(MAPPING_URL, { headers: { accept: "application/json" } })
        .then(async (response) => response.ok
          ? await response.json() as Array<Record<string, unknown>>
          : [])
        .catch(() => [] as Array<Record<string, unknown>>)
    ]).then(([latestBody, mappingBody]) => {
      if (cancelled) return;
      const latest = parseLatestPrices(latestBody.data ?? {});
      const mapping = parseWikiMapping(mappingBody);
      const bank = localBankItemsFromPaste(saved.banktags, mapping);
      if (bank.length === 0) throw new Error("empty saved bank");
      const numericPrices = new Map([...latest].map(([id, price]) => [id, price.value] as const));
      const stats = combatStatsFromSkills(skills);
      setLocalState({
        kind: "ready",
        answers: {
          bosses: BOSSES
            .filter((boss) => !isNonCombatBossActivity(boss))
            .map((boss) => bossViabilityFromSimpleBank(bank, boss, stats))
            .filter((boss): boss is BossViability => boss !== null),
          sets: buildAffordabilityReport(bank, latest, tradeableIndex(mapping)),
          money: buildMoneyMethodFilter({
            skills,
            questsCompleted,
            bank,
            prices: numericPrices,
            cannotBuy
          })
        }
      });
    }).catch(() => {
      if (!cancelled) setLocalState({ kind: "error" });
    });

    return () => { cancelled = true; };
  }, [cannotBuy, hasSyncedBankAnswers, questsCompleted, rsn, skills]);

  const local = localState.kind === "ready" ? localState.answers : null;
  return (
    <div className="space-y-8">
      <PlayerToolNav />
      {localState.kind === "loading" ? (
        <div data-player-tools-loading="true" className="flex min-h-28 items-center gap-3 border-y border-[var(--color-border)] py-5 text-[var(--color-text-muted)]">
          <Loader2 className="size-4 shrink-0 animate-spin text-[var(--color-accent)]" />
          <p className="text-[13px]">Loading all four answers from the bank saved on this device…</p>
        </div>
      ) : (
        <>
          {localState.kind === "error" && (
            <p className="border-y border-[var(--color-border)] py-4 text-[12.5px] text-[var(--color-text-muted)]">
              The bank saved on this device could not be read. Paste it again on the bank intake.
            </p>
          )}
          <PlayerBossesSection bosses={local?.bosses ?? bosses} />
          <PlayerSetsSection report={local?.sets ?? sets} cannotBuy={cannotBuy} />
          <PlayerTaskSection decision={task} emptyReason={emptyTaskReason} />
          <MoneyMethodsPanel report={local?.money ?? money} cannotBuy={cannotBuy} />
        </>
      )}
    </div>
  );
}
