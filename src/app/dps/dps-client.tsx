"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCheck, Copy, Edit3, Sword, Zap, Target, TrendingUp, Coins, Search, X, Sparkles, ExternalLink } from "lucide-react";
import { Intake } from "@/components/intake";
import { SupportCard } from "@/components/support-card";
import { ItemSprite } from "@/components/item-sprite";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { organizeAction } from "@/app/actions";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, lookupGear, GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { bestStyleAndSetup, calcDps, autoSetup, type DpsBreakdown } from "@/lib/dps";
import { cn, formatGp } from "@/lib/utils";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { BossSprite } from "@/components/boss-picker";
import { BankContextActions } from "@/components/bank-context-actions";
import { bossFromDpsParam } from "@/lib/dps-route";
import { copyText } from "@/lib/clipboard";
import { wikiPriceUrl } from "@/lib/item-action";
import { wikiSearchUrl } from "@/lib/wiki";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { buildDpsUpgradeBuyLine } from "@/lib/dps-upgrade-actions";
import { bossViabilityFromGear, styleLabel, type BossViability } from "@/lib/boss-viability";
import {
  bankHandoffItemsFromTabs,
  persistBankHandoffPayload,
  readBankHandoffPayload,
  type BankHandoffSummary
} from "@/lib/next-bank-handoff";
import { buildDpsBankContext } from "@/lib/dps-bank-context";

type BossDpsResult = { boss: Boss; dps: DpsBreakdown };

interface DpsDecision {
  title: string;
  verdict: string;
  why: string;
  firstStep: string;
  stopPoint: string;
  bring: string;
  avoid: string;
  tone: "good" | "warning" | "locked";
}

interface DpsTripReadinessChip {
  label: "Ready" | "Missing food" | "Missing teleport" | "Gear looks weak";
  tone: "good" | "warn";
}

function dpsTripReadiness(
  decision: DpsDecision,
  result: BossDpsResult | null,
  weaponCount: number
): DpsTripReadinessChip[] {
  if (decision.tone === "locked" || weaponCount === 0) {
    return [
      { label: "Gear looks weak", tone: "warn" },
      { label: "Missing food", tone: "warn" }
    ];
  }

  const chips: DpsTripReadinessChip[] = [];
  if (decision.tone === "good" && result) {
    chips.push({ label: "Ready", tone: "good" });
  }
  if (/food/i.test(decision.bring) === false) {
    chips.push({ label: "Missing food", tone: "warn" });
  }
  if (/tele|out/i.test(decision.bring) === false) {
    chips.push({ label: "Missing teleport", tone: "warn" });
  }
  if (decision.tone === "warning") {
    chips.push({ label: "Gear looks weak", tone: "warn" });
  }

  return chips.slice(0, 3);
}

function dpsGpPerHour({ boss, dps }: BossDpsResult) {
  if (!boss.avgLootGp || !boss.killsPerHourCap || dps.dps <= 0) return null;
  return Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp;
}

function buildDpsDecision(
  result: BossDpsResult | null,
  viability: BossViability | null,
  weaponCount: number,
  topUpgrade?: UpgradeSuggestion
): DpsDecision {
  if (!result || !viability || weaponCount === 0 || result.dps.dps <= 0) {
    return {
      title: "Paste combat gear first",
      verdict: "Not yet",
      why: "Scapestack needs at least one usable weapon before it can judge boss trips from this bank.",
      firstStep: "Paste Bank Memory or a combat tab with your weapons.",
      stopPoint: "Stop once DPS can pick a real setup.",
      bring: "Whip, fang, blowpipe, trident, bowfa or another real weapon.",
      avoid: "Avoid trusting boss rows from a supplies-only bank.",
      tone: "locked"
    };
  }

  const gpHour = dpsGpPerHour(result);
  const style = styleLabel(viability.style);
  const weapon = viability.weaponName ?? result.dps.weapon.name;
  const title = viability.tone === "ready"
    ? `Run ${result.boss.name}`
    : viability.tone === "test"
    ? `Test ${result.boss.name}`
    : `${result.boss.name} is not worth it yet`;
  const stopPoint = viability.tone === "ready"
    ? "Stop after 3-5 kills, or sooner if supplies feel wrong."
    : viability.tone === "test"
    ? "Stop after 1-2 kills. If it feels slow, pick a backup."
    : "Stop before entering. Upgrade first or choose an easier boss.";
  const avoid = viability.tone === "blocked"
    ? "Avoid making this tonight's plan from this bank."
    : topUpgrade
    ? `Avoid camping it before checking whether ${topUpgrade.gear.name} is affordable.`
    : "Avoid staring at the full boss list before testing one kill.";

  return {
    title,
    verdict: viability.tone === "ready" ? "Can kill: do one short trip" : viability.tone === "test" ? "Test trip only" : "Not worth yet",
    why: [
      `Bank says ${result.boss.name} is ${viability.tone === "blocked" ? "a bad main pick" : "runnable"}: ${viability.summary}`,
      gpHour ? `Rough upside: ${formatGp(gpHour)} GP/hr if kills feel stable.` : null,
      topUpgrade
        ? `${topUpgrade.gear.name} is the first upgrade worth checking.`
        : "No must-buy upgrade is required before a short test."
    ].filter(Boolean).join(" "),
    firstStep: viability.tone === "blocked"
      ? `Open upgrades or choose a safer boss before gearing for ${result.boss.name}.`
      : `Open ${result.boss.name} detail, lock ${weapon}, then gear for one trip.`,
    stopPoint,
    bring: viability.tone === "blocked"
      ? `${style} upgrade, food, pots and a safer backup.`
      : `${weapon}, ${style} gear, food, pots and tele out.`,
    avoid,
    tone: viability.tone === "blocked" ? "warning" : "good"
  };
}

function dpsDecisionScore(result: BossDpsResult, viability: BossViability): number {
  const gpHour = dpsGpPerHour(result) ?? 0;
  const ttk = viability.ttk ?? result.dps.ttk;
  const toneScore = viability.tone === "ready" ? 10_000 : viability.tone === "test" ? 3_500 : -5_000;
  const speedScore = Number.isFinite(ttk) && ttk > 0 ? Math.max(0, 420 - ttk) * 4 : 0;
  const gpScore = Math.min(2_000, gpHour / 2_500);
  return toneScore + speedScore + gpScore + result.dps.dps * 120;
}

function pickBestBossTrip(results: BossDpsResult[], owned: GearItem[]): BossDpsResult | null {
  let best: { result: BossDpsResult; score: number } | null = null;
  for (const result of results) {
    const viability = bossViabilityFromGear(owned, result.boss);
    const score = dpsDecisionScore(result, viability);
    if (!best || score > best.score) best = { result, score };
  }
  return best?.result ?? null;
}

function DpsIntakeHero() {
  return (
    <section className="mb-5 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-panel)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">
            Boss trip check
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)]">
            Can I kill this with my bank?
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            Paste gear once. Scapestack picks a boss, setup, first trip and upgrade to check.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--color-text-dim)]">
          {["one trip", "owned gear", "upgrade check"].map((chip) => (
            <span key={chip} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function DpsDecisionHero({
  decision,
  result,
  weaponCount,
  upgradeCount,
  copiedUpgradeList,
  onOpenBoss,
  onCopyUpgrades,
  onEditInput
}: {
  decision: DpsDecision;
  result: BossDpsResult | null;
  weaponCount: number;
  upgradeCount: number;
  copiedUpgradeList: "copied" | "failed" | null;
  onOpenBoss: () => void;
  onCopyUpgrades: () => void;
  onEditInput: () => void;
}) {
  const toneClass = decision.tone === "locked"
    ? "border-[var(--color-warning)]/30"
    : decision.tone === "warning"
    ? "border-[var(--color-gold)]/30"
    : "border-[var(--color-accent)]/30";
  const readiness = dpsTripReadiness(decision, result, weaponCount);

  return (
    <section className={cn("mb-6 rounded-xl border bg-[var(--color-panel)] px-4 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] sm:px-5 sm:py-5", toneClass)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/55">
              {result ? <BossSprite boss={result.boss} size={40} /> : <ItemSprite id={4151} alt="" size={30} />}
            </span>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">
                Can I kill this?
              </div>
              <div className="mt-1 text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                Best fit from this bank
              </div>
              <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)] sm:text-[26px]">
                {decision.title}
              </h2>
            </div>
          </div>
          <div className="inline-flex rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[11.5px] font-bold text-[var(--color-accent)]">
            {decision.verdict}
          </div>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            {decision.why}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {readiness.map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  chip.tone === "good"
                    ? "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                    : "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                )}
              >
                {chip.label}
              </span>
            ))}
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-dim)]">
              {weaponCount} weapon{weaponCount === 1 ? "" : "s"}
            </span>
            {result && (
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-dim)]">
                {result.dps.dps.toFixed(2)} DPS
              </span>
            )}
            {upgradeCount > 0 && (
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-dim)]">
                {upgradeCount} upgrade check{upgradeCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {result && (
            <button
              type="button"
              onClick={onOpenBoss}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-[12.5px] font-bold text-white transition-all hover:brightness-110"
            >
              Open boss detail
              <ExternalLink className="size-3.5" />
            </button>
          )}
          {upgradeCount > 0 && (
            <button
              type="button"
              onClick={onCopyUpgrades}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-good)]/30 bg-[var(--color-good)]/8 px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-good)] transition-colors hover:border-[var(--color-good)]/45 hover:bg-[var(--color-good)]/12"
            >
              {copiedUpgradeList === "copied" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiedUpgradeList === "copied" ? "Copied" : "Copy upgrades"}
            </button>
          )}
          <button
            type="button"
            onClick={onEditInput}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-transparent px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            <Edit3 className="size-3.5" />
            Edit bank
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {[
          ["First step", decision.firstStep],
          ["Stop point", decision.stopPoint],
          ["Bring", decision.bring],
          ["Avoid", decision.avoid]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text)]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DpsClient() {
  const [view, setView] = useState<"intake" | "result">("intake");
  const [owned, setOwned] = useState<GearItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [focusedBoss, setFocusedBoss] = useState<Boss | null>(null);
  // Live search query. Filters the visible boss-rows on every keystroke.
  // Replaces the old BossPicker dropdown — having the search field above
  // the table reads more directly ('type to find', not 'click to open').
  const [search, setSearch] = useState("");
  // Sort-order voor de boss-table. Default 'dps' = bestaande gedrag.
  // Andere opties geven een andere lens op dezelfde data:
  //   accuracy  → wie raakt het vaakst (1-shotbaar pures, etc.)
  //   gpHour    → wie levert de meeste GP/u (afgeleid: kills × loot)
  //   ttk       → wie sterft het snelst per kill (XP/u proxy)
  type SortKey = "dps" | "accuracy" | "gpHour" | "ttk";
  const [sortBy, setSortBy] = useState<SortKey>("dps");
  // Currently-open boss in the detail modal. Lifted here so deep-link
  // (?boss=<slug>) can open it on result-view mount, and so the Enter-
  // key search shortcut can open it too.
  const [modalBoss, setModalBoss] = useState<Boss | null>(null);
  const [bankSummary, setBankSummary] = useState<BankHandoffSummary | null>(null);
  const [loadedFromHandoff, setLoadedFromHandoff] = useState(false);
  const [skipHandoff, setSkipHandoff] = useState(false);
  const [copiedUpgradeList, setCopiedUpgradeList] = useState<"copied" | "failed" | null>(null);
  const [copiedUpgradeItem, setCopiedUpgradeItem] = useState<{ id: number; status: "copied" | "failed" } | null>(null);
  const [showUpgradeShoppingList, setShowUpgradeShoppingList] = useState(false);

  // Deep-link: /dps?boss=<slug> pre-selects a boss from the home page's
  // boss-showcase. The actual focus + scroll happens once we have a result
  // view (the player still needs to paste a bank first). We persist the
  // intent across the intake → result transition via a stashed slug.
  const searchParams = useSearchParams();
  const [pendingBossSlug, setPendingBossSlug] = useState<string | null>(null);
  useEffect(() => {
    const slug = searchParams.get("boss");
    if (slug) setPendingBossSlug(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPendingBoss = (slug: string | null) => {
    const target = bossFromDpsParam(slug);
    if (target) {
      setFocusedBoss(target);
      setModalBoss(target);
      setSearch(target.name);
    }
    setPendingBossSlug(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view !== "intake") return;
    if (skipHandoff) return;
    try {
      if (searchParams.get("bank") === "none") return;
      const context = buildDpsBankContext(readBankHandoffPayload(window));
      if (!context) return;
      setOwned(context.owned);
      setBankSummary(context.summary);
      setLoadedFromHandoff(true);
      setView("result");
    } catch {
      // Storage is best-effort. If unavailable, keep the normal paste flow.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, skipHandoff, view]);

  const run = (input: string, _junk: boolean, _rsn: string) => {
    setError(null);
    setSkipHandoff(true);
    startTransition(async () => {
      const res = await organizeAction(input, { junkFilter: false, includePrices: false });
      if (res.error || !res.result) {
        setError(res.error || "Failed to read bank");
        return;
      }
      const flat = res.result.tabs.flatMap((t) => t.items);
      const gear = ownedGear(flat);
      setOwned(gear);
      const context = buildDpsBankContext(bankHandoffItemsFromTabs(res.result.tabs));
      try {
        persistBankHandoffPayload(res.result.tabs, window);
      } catch {
        // Cross-tool handoff is best-effort; DPS still has local state.
      }
      setBankSummary(context?.summary ?? null);
      setLoadedFromHandoff(false);
      setView("result");
      // Resolve the deep-linked boss now that we have a bank. If the
      // slug doesn't match any known boss (raid slug like 'cox' / 'tob'
      // / 'toa' falls through here — they're rooms-of-bosses in the
      // dps engine, no single target) we silently ignore.
    });
  };

  useEffect(() => {
    if (view !== "result") return;
    openPendingBoss(pendingBossSlug ?? searchParams.get("boss"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pendingBossSlug, searchParams]);

  useEffect(() => {
    if (view !== "result") return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, [view]);

  // For each boss, compute the best style/setup. We keep input order so the
  // table groups visually by category; the live search field above handles
  // discovery.
  // Filter skilling-minigames eruit — Wintertodt/Tempoross/Zalcano/GotR
  // hebben hp=0 en geen combat-style. Ze stonden op de DPS-page met
  // valse ranged/melee suggesties. Hespori blijft (heeft echte combat
  // stats al staat hij ook onder category 'skilling').
  const bossResults = useMemo(
    () => BOSSES
      .filter((b) => b.hp > 0 && b.weaknesses.length > 0)
      .map((boss) => ({ boss, dps: bestStyleAndSetup(owned, boss) })),
    [owned]
  );

  // Find global upgrade suggestions — items the player doesn't have that would
  // improve DPS by the largest factor across most bosses.
  const upgrades = useMemo(() => suggestUpgrades(owned), [owned]);
  const focusedBossUpgrades = useMemo(
    () => focusedBoss ? suggestUpgradesForBoss(owned, focusedBoss).slice(0, 3) : [],
    [focusedBoss, owned]
  );
  const visibleUpgrades = focusedBoss ? focusedBossUpgrades : upgrades;
  const upgradeShoppingList = useMemo(() => {
    const title = focusedBoss ? `${focusedBoss.name} DPS upgrades` : "Global DPS upgrades";
    return [
      title,
      ...visibleUpgrades.map((upgrade, index) => `${index + 1}. ${buildDpsUpgradeBuyLine({
        id: upgrade.gear.id,
        name: upgrade.gear.name,
        slot: upgrade.gear.slot,
        dpsGain: upgrade.avgGain,
        scope: focusedBoss ? "vs current setup" : "avg",
        wikiUrl: wikiSearchUrl(upgrade.gear.name),
        geUrl: wikiPriceUrl(upgrade.gear.id)
      })}`)
    ].join("\n");
  }, [focusedBoss, visibleUpgrades]);

  const copyUpgradeShoppingList = async () => {
    const result = await copyText(upgradeShoppingList);
    if (result === "failed") {
      setCopiedUpgradeList("failed");
      return;
    }
    setCopiedUpgradeList("copied");
    window.setTimeout(() => setCopiedUpgradeList(null), 1800);
  };
  const copyUpgradeBuyLine = async (upgrade: UpgradeSuggestion) => {
    const result = await copyText(buildDpsUpgradeBuyLine({
      id: upgrade.gear.id,
      name: upgrade.gear.name,
      slot: upgrade.gear.slot,
      dpsGain: upgrade.avgGain,
      scope: focusedBoss ? "vs current setup" : "avg",
      wikiUrl: wikiSearchUrl(upgrade.gear.name),
      geUrl: wikiPriceUrl(upgrade.gear.id)
    }));
    setCopiedUpgradeItem({
      id: upgrade.gear.id,
      status: result === "failed" ? "failed" : "copied"
    });
    if (result !== "failed") {
      window.setTimeout(() => {
        setCopiedUpgradeItem((current) => current?.id === upgrade.gear.id ? null : current);
      }, 1800);
    }
  };

  // Live-filtered + sorted boss list. Matches against boss.name
  // (lowercased substring) so 'gra' finds 'General Graardor'. Empty
  // query = full list. Sort runs AFTER filter zodat het aantal blijft
  // kloppen met de zichtbare rows.
  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? bossResults.filter(({ boss }) =>
          boss.name.toLowerCase().includes(q) || boss.slug.includes(q)
        )
      : bossResults;
    // GP/u berekening matched aan BossRow logica (zie regel 300):
    //   capped kills × avgLootGp. Null = onbekend → naar achteren.
    const gpHour = (b: typeof base[number]) => {
      const k = b.boss.killsPerHourCap;
      const gp = b.boss.avgLootGp;
      if (!k || !gp || b.dps.dps <= 0) return -1;
      return Math.min(k, Math.floor(3600 / b.dps.ttk)) * gp;
    };
    const sorted = [...base];
    switch (sortBy) {
      case "dps":      sorted.sort((a, b) => b.dps.dps - a.dps.dps); break;
      case "accuracy": sorted.sort((a, b) => b.dps.hitChance - a.dps.hitChance); break;
      case "gpHour":   sorted.sort((a, b) => gpHour(b) - gpHour(a)); break;
      case "ttk":      sorted.sort((a, b) => {
        // TTK = lager is beter; 0/negatief = "niet killbaar" → naar achteren.
        const aT = a.dps.ttk > 0 ? a.dps.ttk : Infinity;
        const bT = b.dps.ttk > 0 ? b.dps.ttk : Infinity;
        return aT - bT;
      }); break;
    }
    return sorted;
  }, [bossResults, search, sortBy]);
  const weaponCount = useMemo(() => owned.filter((gear) => gear.slot === "weapon").length, [owned]);
  const decisionBossResult = useMemo(() => {
    if (focusedBoss) {
      return bossResults.find(({ boss }) => boss.slug === focusedBoss.slug) ?? null;
    }
    return pickBestBossTrip(filteredResults.length > 0 ? filteredResults : bossResults, owned);
  }, [bossResults, filteredResults, focusedBoss, owned]);
  const decisionBossViability = useMemo(
    () => decisionBossResult ? bossViabilityFromGear(owned, decisionBossResult.boss) : null,
    [decisionBossResult, owned]
  );
  const dpsDecision = useMemo(
    () => buildDpsDecision(decisionBossResult, decisionBossViability, weaponCount, visibleUpgrades[0]),
    [decisionBossResult, decisionBossViability, visibleUpgrades, weaponCount]
  );
  const clearBossFilter = () => {
    setSearch("");
    setFocusedBoss(null);
  };
  const editInput = () => {
    setView("intake");
    setError(null);
    setLoadedFromHandoff(false);
    setSkipHandoff(true);
  };

  // Pretty name for the deep-linked boss banner (raid slugs fall through
  // — the banner just doesn't show in that case).
  const pendingBossName = useMemo(() => {
    if (!pendingBossSlug) return null;
    const b = bossFromDpsParam(pendingBossSlug);
    return b?.name ?? null;
  }, [pendingBossSlug]);
  const deepLinkedBoss = useMemo(() => bossFromDpsParam(pendingBossSlug ?? searchParams.get("boss")), [pendingBossSlug, searchParams]);
  const isSlayerTaskSource = searchParams.get("from") === "slayer-task";

  if (view === "intake") {
    return (
      <>
        {pendingBossName && (
          <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-center gap-3 animate-[fade-in_0.3s_ease-out]">
            <Sword className="size-4 text-[var(--color-accent)] shrink-0" />
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              {isSlayerTaskSource ? (
                <>
                  <span className="font-semibold">Slayer task selected:</span>{" "}
                  <span className="text-[var(--color-accent)]">{pendingBossName}</span>. Paste your bank to build the actual setup.
                </>
              ) : (
                <>
                  <span className="font-semibold">Paste your bank</span> and we&apos;ll jump straight to{" "}
                  <span className="text-[var(--color-accent)]">{pendingBossName}</span>&apos;s best setup.
                </>
              )}
            </p>
          </div>
        )}
        <DpsHandoffIntakeHint
          bankless={searchParams.get("bank") === "none"}
          pluginSync={searchParams.get("source") === "plugin-sync"}
          slayerTask={isSlayerTaskSource}
        />
        <DpsIntakeHero />
        <Intake onSubmit={run} loading={pending} error={error} />
      </>
    );
  }

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      <DpsDecisionHero
        decision={dpsDecision}
        result={decisionBossResult}
        weaponCount={weaponCount}
        upgradeCount={visibleUpgrades.length}
        copiedUpgradeList={copiedUpgradeList}
        onOpenBoss={() => {
          if (decisionBossResult) setModalBoss(decisionBossResult.boss);
        }}
        onCopyUpgrades={copyUpgradeShoppingList}
        onEditInput={editInput}
      />

      {bankSummary && weaponCount === 0 && (
        <DpsNoWeaponGate onEditInput={editInput} rsn={searchParams.get("rsn")} />
      )}

      <details className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/50 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--color-text)] marker:hidden">
          <span>Make this trip sharper</span>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">gear, RSN, RuneLite</span>
        </summary>
        <div className="mt-4 space-y-4">
          <ScapestackReadinessRail
            surface="dps"
            hasBankContext={owned.length > 0 || Boolean(bankSummary)}
            hasRsn={Boolean(searchParams.get("rsn"))}
            rsn={searchParams.get("rsn")}
          />

          {bankSummary && (
            <DpsBankContextBanner
              rsn={searchParams.get("rsn")}
              summary={bankSummary}
              weaponCount={weaponCount}
              loadedFromHandoff={loadedFromHandoff}
              focusedBoss={deepLinkedBoss}
              focusedBossSource={isSlayerTaskSource ? "slayer-task" : "bank"}
            />
          )}
        </div>
      </details>

      {/* Upgrade suggestions */}
      {visibleUpgrades.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[var(--color-good)]" />
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-gold-soft)]">
                  {focusedBoss ? `${focusedBoss.name} upgrade check` : "Upgrade before camping"}
                </h2>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                {focusedBoss
                  ? `Only items that help ${focusedBoss.name} from this bank. Clear the boss filter to compare every boss.`
                  : "Worth checking before you camp a boss for a longer session."}
              </p>
            </div>
            <button
              type="button"
              onClick={copyUpgradeShoppingList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/30 bg-[var(--color-good)]/8 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-good)] transition-colors hover:border-[var(--color-good)]/45 hover:bg-[var(--color-good)]/12"
              aria-label={focusedBoss ? `Copy ${focusedBoss.name} upgrade shopping list` : "Copy global upgrade shopping list"}
            >
              {copiedUpgradeList === "copied" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiedUpgradeList === "copied"
                ? "Upgrade list copied"
                : copiedUpgradeList === "failed"
                  ? "Copy failed"
                  : "Copy shopping list"}
            </button>
            <button
              type="button"
              onClick={() => setShowUpgradeShoppingList((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              aria-expanded={showUpgradeShoppingList}
              aria-label={showUpgradeShoppingList ? "Hide upgrade shopping list text" : "Show upgrade shopping list text"}
            >
              {showUpgradeShoppingList ? "Hide list" : "View list"}
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {visibleUpgrades.map((upgrade) => (
              <div
                key={upgrade.gear.id}
                className={cn(
                  "rounded-xl p-3 border border-[var(--color-good)]/30",
                  "bg-gradient-to-br from-[oklch(0.22_0.06_145/0.10)] to-[var(--color-bg-2)]"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ItemSprite
                    id={upgrade.gear.id}
                    alt=""
                    loading="lazy"
                    className="pixelated shrink-0 pointer-events-none"
                    style={{
                      maxWidth: "28px",
                      maxHeight: "28px",
                      width: "auto",
                      height: "auto"
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">{upgrade.gear.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                      #{upgrade.gear.id} · {upgrade.gear.slot}
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] mb-1.5">
                  Adds <span className="text-[var(--color-good)] font-bold">+{upgrade.avgGain.toFixed(1)} DPS</span>{" "}
                  {focusedBoss ? "vs current setup" : "avg"}
                </div>
                <div className="text-[10.5px] text-[var(--color-text-dim)]">
                  {focusedBoss ? (
                    <>
                      Helps <span className="text-[var(--color-gold-soft)]">{focusedBoss.name}</span> directly.
                    </>
                  ) : (
                    <>
                      Helps in: <span className="text-[var(--color-gold-soft)]">{upgrade.bossLabels.slice(0, 3).join(", ")}</span>
                      {upgrade.bossLabels.length > 3 && ` +${upgrade.bossLabels.length - 3}`}
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <a
                    href={wikiSearchUrl(upgrade.gear.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                    aria-label={`Open ${upgrade.gear.name} item ID ${upgrade.gear.id} on the OSRS Wiki`}
                  >
                    Wiki
                    <ExternalLink className="size-3" />
                  </a>
                  <a
                    href={wikiPriceUrl(upgrade.gear.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-good)]/25 bg-[var(--color-good)]/8 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-good)] transition-colors hover:border-[var(--color-good)]/45 hover:bg-[var(--color-good)]/12"
                    aria-label={`Open ${upgrade.gear.name} item ID ${upgrade.gear.id} GE price on the OSRS Wiki`}
                  >
                    GE price
                    <ExternalLink className="size-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyUpgradeBuyLine(upgrade)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors",
                      copiedUpgradeItem?.id === upgrade.gear.id && copiedUpgradeItem.status === "copied"
                        ? "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                        : copiedUpgradeItem?.id === upgrade.gear.id && copiedUpgradeItem.status === "failed"
                          ? "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                    )}
                    aria-label={`Copy ${upgrade.gear.name} item ID ${upgrade.gear.id} DPS upgrade buy line`}
                  >
                    <Copy className="size-3" />
                    {copiedUpgradeItem?.id === upgrade.gear.id
                      ? copiedUpgradeItem.status === "copied" ? "Copied" : "Copy failed"
                      : "Copy buy line"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {(copiedUpgradeList === "failed" || showUpgradeShoppingList) && (
            <div className="mt-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3" aria-live="polite">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-warning)]">
                {copiedUpgradeList === "failed" ? "Clipboard failed — copy shopping list manually" : "Upgrade shopping list text"}
              </label>
              <textarea
                readOnly
                value={upgradeShoppingList}
                onFocus={(event) => event.currentTarget.select()}
                className="min-h-[116px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text)]"
                aria-label={focusedBoss ? `Manual ${focusedBoss.name} upgrade shopping list` : "Manual global upgrade shopping list"}
              />
            </div>
          )}
        </section>
      )}

      {/* Boss table */}
      <details className="mb-7 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Compare other bosses
            </span>
            <span className="mt-1 block text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Search and sort the full table only when the first trip is not the one.
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-text-dim)]">
            Show
          </span>
        </summary>
        <div className="mt-4">
          <div className="mb-3">
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-2">
              Boss options with this bank
            </h2>
            {/* Live search. Filters the rows below on every keystroke;
                ESC clears. The dropdown BossPicker is gone — for a table
                with 50+ rows, a real input field reads more directly than
                'click to open a hidden menu.' */}
            <div className="relative">
              <label htmlFor="dps-boss-search" className="sr-only">
                Search bosses for DPS setup
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
              <input
                id="dps-boss-search"
                name="boss"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (focusedBoss && e.target.value.trim().toLowerCase() !== focusedBoss.name.toLowerCase()) {
                    setFocusedBoss(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") clearBossFilter();
                  if (e.key === "Enter" && filteredResults.length > 0) {
                    // Open the first match directly in the detail modal —
                    // saves the user a follow-up click after typing.
                    setModalBoss(filteredResults[0].boss);
                  }
                }}
                placeholder="Search bosses — type to filter, Enter to jump"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="dps-boss-search-help dps-boss-search-status"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 focus:shadow-[0_0_0_3px_rgba(134, 166, 217,0.10)] text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearBossFilter}
                  aria-label="Clear boss DPS search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-2)] transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <p id="dps-boss-search-help" className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
              Type a boss name, press Enter to open the first match, or Esc to clear the filter.
            </p>
            {focusedBoss && search.trim().toLowerCase() === focusedBoss.name.toLowerCase() && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-2">
                <span className="inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/60">
                  <BossSprite boss={focusedBoss} size={22} />
                </span>
                <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Filtered from bank boss: <span className="font-semibold text-[var(--color-accent)]">{focusedBoss.name}</span>.
                  Clear it to compare all bosses with the same bank.
                </p>
                <button
                  type="button"
                  onClick={clearBossFilter}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                >
                  Show all bosses
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            {search && (
              <p id="dps-boss-search-status" role="status" aria-live="polite" className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                {filteredResults.length === 0
                  ? `No bosses match "${search}".`
                  : `Showing ${filteredResults.length} of ${bossResults.length} bosses.`}
              </p>
            )}
            {/* Sort selector — pill-style toggle group. Default DPS is de
                standaard waar mensen voor komen; de andere drie geven
                dezelfde lijst maar door een andere bril ('wie raakt vaakst',
                'wie levert het meest GP', 'wie gaat snelst dood'). */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Sort
              </span>
              {([
                { key: "dps",      label: "Best DPS" },
                { key: "accuracy", label: "Most accurate" },
                { key: "gpHour",   label: "Most GP/hour" },
                { key: "ttk",      label: "Fastest kill" }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={sortBy === opt.key}
                  aria-label={`Sort boss DPS rows by ${opt.label}`}
                  onClick={() => setSortBy(opt.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] border transition-colors",
                    sortBy === opt.key
                      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            {filteredResults.map(({ boss, dps }) => (
              <BossRow
                key={boss.slug}
                boss={boss}
                dps={dps}
                isFocused={focusedBoss?.slug === boss.slug}
                onOpen={() => setModalBoss(boss)}
              />
            ))}
          </div>
          <p className="mt-6 text-[10.5px] text-center text-[var(--color-text-dim)] italic">
            DPS calculated at level 99 stats with full offensive prayer (Piety / Rigour / Augury).
            Boss-specific mechanics (heap mode, transitions, specs) not modelled.
          </p>
        </div>
      </details>

      <SupportCard context="Helped pick your gear for tonight's trip?" />

      {/* Boss detail modal — big portrait + best gear + per-boss
          upgrades + inventory loadout. Replaces the row-expand interaction
          for the deep view. */}
      {modalBoss && (
        <BossDetailModal
          boss={modalBoss}
          owned={owned}
          onClose={() => setModalBoss(null)}
        />
      )}
    </div>
  );
}

// ── Boss row ──

function BossRow({ boss, dps, isFocused, onOpen }: {
  boss: Boss;
  dps: DpsBreakdown;
  isFocused: boolean;
  onOpen: () => void;
}) {
  const usable = dps.dps > 0;
  const gpPerHour =
    usable && boss.avgLootGp && boss.killsPerHourCap
      ? Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp
      : null;

  const styleIcon: Record<CombatStyle, React.ReactNode> = {
    stab:    <Sword className="size-3.5" />,
    slash:   <Sword className="size-3.5" />,
    crush:   <Sword className="size-3.5" />,
    ranged:  <Target className="size-3.5" />,
    magic:   <Zap className="size-3.5" />
  };

  return (
    <button
      type="button"
      id={`boss-${boss.slug}`}
      onClick={onOpen}
      aria-label={`Open ${boss.name} DPS setup details`}
      title={`Open ${boss.name} DPS setup details`}
      className={cn(
        "w-full text-left rounded-xl border scroll-mt-24 p-3.5 flex items-center gap-4 flex-wrap",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border-[var(--color-border)]",
        "hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_0_1px_rgba(134, 166, 217,0.12)] transition-all cursor-pointer",
        isFocused && "border-[var(--color-accent)]/40 shadow-[0_0_0_1px_rgba(134, 166, 217,0.18)]"
      )}>
      <div className="flex items-center gap-2.5 min-w-0 w-[160px]">
        <BossThumb boss={boss} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--color-text)] truncate">{boss.name}</div>
          <div className="text-[10.5px] text-[var(--color-text-dim)]">{boss.hp} hp</div>
        </div>
      </div>

      {usable ? (
        <>
          <Stat label="Style" value={dps.style.toUpperCase()} icon={styleIcon[dps.style]} />
          <Stat label="Weapon" value={dps.weapon.name} />
          <Stat label="Max hit" value={String(dps.maxHit)} />
          <Stat label="Accuracy" value={`${Math.round(dps.hitChance * 100)}%`} />
          <Stat label="DPS" value={dps.dps.toFixed(2)} highlight />
          <Stat label="TTK" value={`${dps.ttk.toFixed(0)}s`} />
          {gpPerHour && (
            <Stat label="GP/hr" value={formatGp(gpPerHour)} icon={<Coins className="size-3.5 text-[var(--color-gold)]" />} />
          )}
          <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-accent)]">
            Details
            <ExternalLink className="size-3" />
          </span>
        </>
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-[var(--color-text-dim)] italic">
            Add a weapon before picking this trip.
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-dim)]">
            View requirements
            <ExternalLink className="size-3" />
          </span>
        </div>
      )}
    </button>
  );
}

function Stat({ label, value, icon, highlight }: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]/70 flex items-center gap-0.5">
        {icon}
        {label}
      </div>
      <div className={cn(
        "text-[12.5px] font-bold tabular-nums",
        highlight ? "text-[var(--color-gold)]" : "text-[var(--color-text)]"
      )}>
        {value}
      </div>
    </div>
  );
}

function DpsHandoffIntakeHint({
  bankless,
  pluginSync,
  slayerTask
}: {
  bankless: boolean;
  pluginSync: boolean;
  slayerTask: boolean;
}) {
  if (bankless) {
    return (
      <div className="mb-4 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 px-4 py-3 flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
        <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
          {pluginSync
            ? "RuneLite skips finished account stuff, but DPS still needs your gear. Paste Bank Memory or Bank Tags to check real setups."
            : slayerTask
            ? "This boss came from Task Check. Paste gear before buying supplies or trusting upgrades."
            : "Paste Bank Memory or Bank Tags before using boss checks, upgrades or setup links."}
        </p>
      </div>
    );
  }

  if (!slayerTask) return null;

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-panel)]/70 px-4 py-3 flex items-start gap-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        Task picked. Paste gear to check the setup before the first trip.
      </p>
    </div>
  );
}

function DpsBankContextBanner({
  rsn,
  summary,
  weaponCount,
  loadedFromHandoff,
  focusedBoss,
  focusedBossSource
}: {
  rsn?: string | null;
  summary: BankHandoffSummary;
  weaponCount: number;
  loadedFromHandoff: boolean;
  focusedBoss: Boss | null;
  focusedBossSource: "bank" | "slayer-task";
}) {
  const hasWeapons = weaponCount > 0;
  const focusedBossLabel = focusedBossSource === "slayer-task"
    ? "Slayer picked:"
    : "Bank picked:";
  return (
    <section className="mb-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/40">
            <ItemSprite id={20594} alt="" size={25} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {loadedFromHandoff ? "Gear loaded" : "Gear pasted"}
            </div>
            {focusedBoss && (
              <div
                data-testid="dps-focused-boss-receipt"
                className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)]"
              >
                <span className="inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/60">
                  <BossSprite boss={focusedBoss} size={22} />
                </span>
                <span className="truncate">
                  {focusedBossLabel} <span className="text-[var(--color-accent)]">{focusedBoss.name}</span>
                </span>
              </div>
            )}
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{summary.label}</span>
              {" · "}
              {weaponCount} weapon{weaponCount === 1 ? "" : "s"} recognised.{" "}
              {hasWeapons && focusedBoss
                ? `${focusedBoss.name} and the boss list now use this gear.`
                : hasWeapons
                ? "The boss list now uses this gear."
                : "Boss checks need at least one usable combat weapon."}
            </p>
            {!hasWeapons && (
              <div className="mt-3 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 px-3 py-2.5">
                <p className="text-[12px] font-semibold leading-relaxed text-[var(--color-warning)]">
                  Gear paste is active, but this looks like supplies/jewellery only.
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Paste a full Bank Memory export or a combat tab with weapons like whip, fang, blowpipe, trident, bowfa, godswords or scythe to unlock real boss checks.
                </p>
              </div>
            )}
            {summary.topItems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.topItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                    title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                  >
                    <ItemSprite id={item.id} alt="" size={15} />
                    <span className="max-w-[130px] truncate">{item.name}</span>
                    <span className="font-mono text-[var(--color-text-muted)]">{formatGp(item.stackValue)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <BankContextActions source="dps" rsn={rsn} />
      </div>
    </section>
  );
}

function DpsNoWeaponGate({
  onEditInput,
  rsn
}: {
  onEditInput: () => void;
  rsn?: string | null;
}) {
  const bankHref = bankOrganizerHref(rsn, "dps");
  const weaponExamples = [
    { id: 4151, name: "Whip" },
    { id: 26219, name: "Fang" },
    { id: 12926, name: "Blowpipe" },
    { id: 11907, name: "Trident" },
    { id: 25865, name: "Bowfa" },
    { id: 20997, name: "Twisted bow" }
  ];

  return (
    <section
      data-testid="dps-no-weapon-gate"
      className="mb-7 rounded-xl border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8 px-4 py-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-warning)]">
            Need a weapon first
          </div>
          <h2 className="mt-1 text-[17px] font-bold tracking-normal text-[var(--color-text)]">
            Paste combat gear before picking a boss
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            This bank has supplies, jewellery or loot, but no usable weapon. Add a full Bank Memory export or a combat tab with one of these weapon types, then Scapestack can choose real boss trips from owned gear.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {weaponExamples.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] font-semibold text-[var(--color-text-dim)]"
              >
                <ItemSprite id={item.id} alt="" size={18} />
                {item.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditInput}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-warning)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110"
          >
            Paste combat bank
            <Edit3 className="size-3.5" />
          </button>
          <Link
            href={bankHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Open Gear & Bank
            <Sparkles className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Upgrade suggester ──

interface UpgradeSuggestion {
  gear: GearItem;
  avgGain: number;
  bossLabels: string[];
}

function suggestUpgrades(owned: GearItem[]): UpgradeSuggestion[] {
  const ownedIds = new Set(owned.map((g) => g.id));
  const candidates: UpgradeSuggestion[] = [];

  // For each item player DOESN'T own, simulate giving it to them and measure
  // DPS gain averaged across all bosses where it helps.
  for (const g of GEAR) {
    if (ownedIds.has(g.id)) continue;

    let totalGain = 0;
    const helpedBosses: string[] = [];

    for (const boss of BOSSES) {
      // For each style, compare with vs without
      const styles: CombatStyle[] = g.weaponStyle
        ? [g.weaponStyle]
        : g.slot === "weapon"
          ? []
          : ["stab", "slash", "crush", "ranged", "magic"];

      for (const style of styles) {
        const baseSetup = autoSetup(owned, style);
        if (!baseSetup.weapon) continue;
        const baseDps = calcDps(baseSetup, boss, style).dps;

        const withGear = autoSetup([...owned, g], style);
        if (!withGear.weapon) continue;
        const newDps = calcDps(withGear, boss, style).dps;

        const gain = newDps - baseDps;
        if (gain > 0.05) {
          totalGain += gain;
          if (!helpedBosses.includes(boss.name)) helpedBosses.push(boss.name);
        }
      }
    }

    if (totalGain > 0.5 && helpedBosses.length > 0) {
      candidates.push({
        gear: g,
        avgGain: totalGain / helpedBosses.length,
        bossLabels: helpedBosses
      });
    }
  }

  return candidates
    .sort((a, b) => (b.avgGain * b.bossLabels.length) - (a.avgGain * a.bossLabels.length))
    .slice(0, 3);
}

function suggestUpgradesForBoss(owned: GearItem[], boss: Boss): UpgradeSuggestion[] {
  const ownedIds = new Set(owned.map((g) => g.id));
  const candidates: UpgradeSuggestion[] = [];

  for (const gear of GEAR) {
    if (ownedIds.has(gear.id)) continue;

    const styles: CombatStyle[] = gear.weaponStyle
      ? [gear.weaponStyle]
      : gear.slot === "weapon"
        ? []
        : ["stab", "slash", "crush", "ranged", "magic"];

    let bestGain = 0;
    for (const style of styles) {
      const baseSetup = autoSetup(owned, style);
      if (!baseSetup.weapon) continue;
      const baseDps = calcDps(baseSetup, boss, style).dps;
      const withGear = autoSetup([...owned, gear], style);
      if (!withGear.weapon) continue;
      const newDps = calcDps(withGear, boss, style).dps;
      bestGain = Math.max(bestGain, newDps - baseDps);
    }

    if (bestGain > 0.05) {
      candidates.push({
        gear,
        avgGain: bestGain,
        bossLabels: [boss.name]
      });
    }
  }

  return candidates.sort((a, b) => b.avgGain - a.avgGain);
}

// Boss thumbnail. Tries the local wiki portrait first
// Uses the shared BossSprite fallback contract so DPS rows never fall back to
// emoji or an anonymous dot: local boss art → signature item sprite → labelled
// missing-sprite tile.
function BossThumb({ boss }: { boss: Boss }) {
  return (
    <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
      <BossSprite boss={boss} size={36} />
    </div>
  );
}
