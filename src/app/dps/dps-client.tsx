"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Edit3, Sword, Search, X, Sparkles, ExternalLink } from "lucide-react";
import { Intake } from "@/components/intake";
import { SupportCard } from "@/components/support-card";
import { ItemSprite } from "@/components/item-sprite";
import { organizeAction } from "@/app/actions";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, lookupGear, type GearItem } from "@/lib/gear";
import { bestStyleAndSetup, type DpsBreakdown } from "@/lib/dps";
import { cn, formatGp } from "@/lib/utils";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { BossSprite } from "@/components/boss-picker";
import { bossFromDpsParam } from "@/lib/dps-route";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { getActiveAccount } from "@/lib/account-storage";
import { loadSavedBank, loadSavedRsn, saveSavedBank, saveSavedRsn } from "@/lib/saved-bank";
import {
  bankHandoffItemsFromTabs,
  persistBankHandoffPayload,
  readBankHandoffPayload,
  type BankHandoffSummary
} from "@/lib/next-bank-handoff";
import { buildDpsBankContext } from "@/lib/dps-bank-context";

type BossDpsResult = { boss: Boss; dps: DpsBreakdown };
type BossFilter = "all" | "solo" | "slayer" | "wildy" | "raid" | "beginner" | "gp";

const BOSS_FILTERS: Array<{ key: BossFilter; label: string }> = [
  { key: "all", label: "All bosses" },
  { key: "solo", label: "Solo" },
  { key: "slayer", label: "Slayer" },
  { key: "wildy", label: "Wildy" },
  { key: "raid", label: "Raid" },
  { key: "beginner", label: "Beginner" },
  { key: "gp", label: "GP" }
];

function DpsIntakeHero() {
  return (
    <section className="mb-5 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-panel)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">
            Kill check
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)]">
            Can I kill this with my bank?
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            Add bank once. Scapestack picks a boss, gear and first trip to try.
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

function DpsMissingSetupState({
  boss,
  setupHref,
  pluginSync,
  slayerTask
}: {
  boss: Boss | null;
  setupHref: string;
  pluginSync: boolean;
  slayerTask: boolean;
}) {
  const title = boss ? `Add bank for ${boss.name}` : "Add bank";
  const body = pluginSync
    ? "RuneLite skips finished account stuff, but this kill check still needs your bank."
    : slayerTask && boss
    ? `${boss.name} came from Task Check. Add bank before buying supplies or trusting upgrades.`
    : boss
    ? `Scapestack will pick your best owned setup for ${boss.name}.`
    : "Scapestack will pick the best boss setup from your bank.";

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-panel)] px-4 py-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/50">
            {boss ? <BossSprite boss={boss} size={42} /> : <ItemSprite id={20594} alt="" size={30} />}
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              No bank yet
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)]">
              {title}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              {body}
            </p>
          </div>
        </div>
        <Link
          href={setupHref}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-[13px] font-bold text-white transition-all hover:brightness-110 sm:w-auto"
        >
          Add bank
          <ExternalLink className="size-3.5" />
        </Link>
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
  const [bossFilter, setBossFilter] = useState<BossFilter>("all");
  // Currently-open boss in the detail modal. Lifted here so deep-link
  // (?boss=<slug>) can open it on result-view mount, and so the Enter-
  // key search shortcut can open it too.
  const [modalBoss, setModalBoss] = useState<Boss | null>(null);
  const [bankSummary, setBankSummary] = useState<BankHandoffSummary | null>(null);
  const [loadedFromHandoff, setLoadedFromHandoff] = useState(false);
  const [skipHandoff, setSkipHandoff] = useState(false);

  // Deep-link: /dps?boss=<slug> pre-selects a boss from the home page's
  // boss-showcase. The actual focus + scroll happens once we have a result
  // view (the player still needs to paste a bank first). We persist the
  // intent across the intake → result transition via a stashed slug.
  const searchParams = useSearchParams();
  const [accountRsn, setAccountRsn] = useState("");
  const [hasKnownSetup, setHasKnownSetup] = useState(false);
  const [pendingBossSlug, setPendingBossSlug] = useState<string | null>(null);
  const urlRsn = searchParams.get("rsn")?.trim() ?? "";
  const effectiveRsn = urlRsn || accountRsn;

  useEffect(() => {
    const nextRsn = urlRsn || getActiveAccount()?.rsn || loadSavedRsn() || "";
    setAccountRsn(nextRsn);
    setHasKnownSetup(Boolean(loadSavedBank(nextRsn)));
    if (nextRsn && !urlRsn) saveSavedRsn(nextRsn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const savedSetup = loadSavedBank(effectiveRsn);
    setHasKnownSetup(Boolean(savedSetup));
    try {
      if (searchParams.get("bank") === "none" && !savedSetup) return;
      const context = buildDpsBankContext(readBankHandoffPayload(window));
      if (context) {
        setOwned(context.owned);
        setBankSummary(context.summary);
        setLoadedFromHandoff(true);
        setView("result");
        return;
      }
    } catch {
      // Storage is best-effort. If unavailable, keep the normal paste flow.
    }
    if (savedSetup) {
      startTransition(async () => {
        const res = await organizeAction(savedSetup.banktags, { junkFilter: false, includePrices: false });
        if (res.error || !res.result) {
          setError(res.error || "Failed to read setup");
          return;
        }
        const context = buildDpsBankContext(bankHandoffItemsFromTabs(res.result.tabs));
        if (!context) return;
        setOwned(context.owned);
        setBankSummary(context.summary);
        setLoadedFromHandoff(true);
        setView("result");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRsn, searchParams, skipHandoff, view]);

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
      const setupRsn = _rsn.trim() || effectiveRsn;
      saveSavedBank(input, setupRsn);
      if (setupRsn) saveSavedRsn(setupRsn);
      setHasKnownSetup(true);
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

  const bossMatchesFilter = (entry: BossDpsResult) => {
    const { boss } = entry;
    switch (bossFilter) {
      case "solo":
        return boss.category !== "raid" && boss.slug !== "nex";
      case "slayer":
        return boss.category === "slayer";
      case "wildy":
        return boss.category === "wildy";
      case "raid":
        return boss.category === "raid";
      case "beginner":
        return boss.hp > 0 && boss.hp <= 320 && boss.category !== "raid" && boss.category !== "dt2" && boss.category !== "gwd";
      case "gp":
        return Boolean(boss.avgLootGp);
      case "all":
      default:
        return true;
    }
  };

  const gpHourForBoss = (entry: BossDpsResult) => {
    const k = entry.boss.killsPerHourCap;
    const gp = entry.boss.avgLootGp;
    if (!k || !gp || entry.dps.dps <= 0) return -1;
    return Math.min(k, Math.floor(3600 / entry.dps.ttk)) * gp;
  };

  // Live-filtered + sorted boss list. Matches against boss.name
  // (lowercased substring) so 'gra' finds 'General Graardor'. Empty
  // query = full list. Sort runs AFTER filter zodat het aantal blijft
  // kloppen met de zichtbare rows.
  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = q
      ? bossResults.filter(({ boss }) =>
          boss.name.toLowerCase().includes(q) || boss.slug.includes(q)
        )
      : bossResults;
    const base = searched.filter(bossMatchesFilter);
    const sorted = [...base];
    switch (sortBy) {
      case "dps":      sorted.sort((a, b) => b.dps.dps - a.dps.dps); break;
      case "accuracy": sorted.sort((a, b) => b.dps.hitChance - a.dps.hitChance); break;
      case "gpHour":   sorted.sort((a, b) => gpHourForBoss(b) - gpHourForBoss(a)); break;
      case "ttk":      sorted.sort((a, b) => {
        // TTK = lager is beter; 0/negatief = "niet killbaar" → naar achteren.
        const aT = a.dps.ttk > 0 ? a.dps.ttk : Infinity;
        const bT = b.dps.ttk > 0 ? b.dps.ttk : Infinity;
        return aT - bT;
      }); break;
    }
    return sorted;
  }, [bossResults, bossFilter, search, sortBy]);
  const weaponCount = useMemo(() => owned.filter((gear) => gear.slot === "weapon").length, [owned]);
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
  const setupBossSlug = pendingBossSlug ?? searchParams.get("boss");
  const setupBankHref = useMemo(
    () => bankOrganizerHref(effectiveRsn, "dps", { boss: setupBossSlug }),
    [effectiveRsn, setupBossSlug]
  );
  const isSlayerTaskSource = searchParams.get("from") === "slayer-task";
  const needsSetupBeforeDps = (Boolean(deepLinkedBoss) || searchParams.get("bank") === "none") && !hasKnownSetup;

  if (view === "intake") {
    if (needsSetupBeforeDps) {
      return (
        <DpsMissingSetupState
          boss={deepLinkedBoss}
          setupHref={setupBankHref}
          pluginSync={searchParams.get("source") === "plugin-sync"}
          slayerTask={isSlayerTaskSource}
        />
      );
    }

    return (
      <>
        {pendingBossName && (
          <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex flex-col gap-3 animate-[fade-in_0.3s_ease-out] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
            <Sword className="size-4 text-[var(--color-accent)] shrink-0" />
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              {isSlayerTaskSource ? (
                <>
                  <span className="font-semibold">Slayer task selected:</span>{" "}
                  <span className="text-[var(--color-accent)]">{pendingBossName}</span>. Add bank to build the trip from your bank.
                </>
              ) : (
                <>
                  <span className="font-semibold">Add bank</span> and we&apos;ll jump straight to{" "}
                  <span className="text-[var(--color-accent)]">{pendingBossName}</span> with your best gear.
                </>
              )}
            </p>
            </div>
            <Link
              href={setupBankHref}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-[12.5px] font-bold text-white transition-all hover:brightness-110 sm:w-auto"
            >
              Add bank
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        )}
        <DpsHandoffIntakeHint
          bankless={searchParams.get("bank") === "none"}
          pluginSync={searchParams.get("source") === "plugin-sync"}
          slayerTask={isSlayerTaskSource}
          setupHref={setupBankHref}
        />
        <DpsIntakeHero />
        <Intake onSubmit={run} loading={pending} error={error} />
      </>
    );
  }

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      {bankSummary && weaponCount === 0 && (
        <DpsNoWeaponGate onEditInput={editInput} setupHref={setupBankHref} />
      )}

      {/* Boss list */}
      <section className="mb-7 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
              Pick a boss
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Search any boss. Click one to see your best gear, DPS, supplies and upgrades from this bank.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
            {bossResults.length} bosses checked
          </span>
        </div>
        <div>
          <div className="mb-3">
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-2">
              All bosses
            </h2>
            {/* Live search. Filters the rows below on every keystroke;
                ESC clears. The dropdown BossPicker is gone — for a table
                with 50+ rows, a real input field reads more directly than
                'click to open a hidden menu.' */}
            <div className="relative">
              <label htmlFor="dps-boss-search" className="sr-only">
                Search bosses for a kill setup
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
                  aria-label="Clear boss search"
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
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter bosses">
              {BOSS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={bossFilter === filter.key}
                  onClick={() => setBossFilter(filter.key)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-[12px] font-bold transition-colors",
                    bossFilter === filter.key
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                      : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-text)]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {/* Sort selector — pill-style toggle group. Default kill speed is de
                standaard waar mensen voor komen; de andere drie geven
                dezelfde lijst maar door een andere bril ('wie raakt vaakst',
                'wie levert het meest GP', 'wie gaat snelst dood'). */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Sort
              </span>
              {([
                { key: "dps",      label: "Best kill speed" },
                { key: "accuracy", label: "Most accurate" },
                { key: "gpHour",   label: "Most GP/hour" },
                { key: "ttk",      label: "Fastest kill" }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={sortBy === opt.key}
                  aria-label={`Sort boss rows by ${opt.label}`}
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredResults.map(({ boss, dps }) => (
              <BossCard
                key={boss.slug}
                boss={boss}
                dps={dps}
                isFocused={focusedBoss?.slug === boss.slug}
                onOpen={() => setModalBoss(boss)}
              />
            ))}
          </div>
          <p className="mt-6 text-[10.5px] text-center text-[var(--color-text-dim)] italic">
            Kill speed is estimated at level 99 stats with full offensive prayer (Piety / Rigour / Augury).
            Boss-specific mechanics (heap mode, transitions, specs) not modelled.
          </p>
        </div>
      </section>

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

// ── Boss card ──

function BossCard({ boss, dps, isFocused, onOpen }: {
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
  const status = !usable ? "Need weapon" : dps.hitChance >= 0.55 ? "Can kill" : "Test first";

  return (
    <button
      type="button"
      id={`boss-${boss.slug}`}
      onClick={onOpen}
      aria-label={`Open ${boss.name} kill setup details`}
      title={`Open ${boss.name} kill setup details`}
      className={cn(
        "group min-h-[178px] w-full scroll-mt-24 rounded-xl border p-3 text-left transition-all",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border-[var(--color-border)]",
        "hover:-translate-y-0.5 hover:border-[var(--color-accent)]/55 hover:shadow-[0_14px_34px_-24px_rgba(240,176,44,0.55)]",
        isFocused && "border-[var(--color-accent)]/55 shadow-[0_0_0_1px_rgba(240,176,44,0.22)]"
      )}>
      <div className="flex items-start justify-between gap-2">
        <BossThumb boss={boss} />
        <span className={cn(
          "rounded-full border px-2 py-1 text-[10px] font-bold",
          !usable
            ? "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
            : dps.hitChance >= 0.55
              ? "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text-dim)]"
        )}>
          {status}
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate text-[13px] font-bold text-[var(--color-text)]">{boss.name}</div>
        <div className="mt-0.5 text-[10.5px] text-[var(--color-text-dim)]">{boss.hp} hp</div>
      </div>
      {usable ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[var(--color-text-muted)]">DPS</span>
            <span className="font-mono font-bold text-[var(--color-accent)]">{dps.dps.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[var(--color-text-muted)]">Style</span>
            <span className="font-bold uppercase text-[var(--color-text)]">{dps.style}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[var(--color-text-muted)]">Weapon</span>
            <span className="max-w-[105px] truncate font-semibold text-[var(--color-text)]">{dps.weapon.name}</span>
          </div>
          {gpPerHour && (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[var(--color-text-muted)]">GP/hr</span>
              <span className="font-mono font-semibold text-[var(--color-text)]">{formatGp(gpPerHour)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
          Add a weapon to see setup and upgrades.
        </p>
      )}
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)]">
        Open details
        <ExternalLink className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function DpsHandoffIntakeHint({
  bankless,
  pluginSync,
  slayerTask,
  setupHref
}: {
  bankless: boolean;
  pluginSync: boolean;
  slayerTask: boolean;
  setupHref: string;
}) {
  if (bankless) {
    return (
      <div className="mb-4 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            {pluginSync
              ? "RuneLite skips finished account stuff, but boss checks still need your bank."
              : slayerTask
              ? "This boss came from Task Check. Add bank before buying supplies or trusting upgrades."
              : "Add bank before using boss checks, upgrades or setup links."}
          </p>
        </div>
        <Link
          href={setupHref}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-warning)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110 sm:w-auto"
        >
          Add bank
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    );
  }

  if (!slayerTask) return null;

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-panel)]/70 px-4 py-3 flex items-start gap-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        Task picked. Add bank before trusting the first trip.
      </p>
    </div>
  );
}

function DpsNoWeaponGate({
  onEditInput,
  setupHref
}: {
  onEditInput: () => void;
  setupHref: string;
}) {
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
            Add bank here
            <Edit3 className="size-3.5" />
          </button>
          <Link
            href={setupHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Add bank
            <Sparkles className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Boss thumbnail. Tries the local wiki portrait first
// Uses the shared BossSprite fallback contract so boss options never fall back to
// emoji or an anonymous dot: local boss art → signature item sprite → labelled
// missing-sprite tile.
function BossThumb({ boss }: { boss: Boss }) {
  return (
    <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
      <BossSprite boss={boss} size={36} />
    </div>
  );
}
