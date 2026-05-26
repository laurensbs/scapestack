"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Sword, Zap, Target, TrendingUp, Coins, Search, X } from "lucide-react";
import { Intake } from "@/components/intake";
import { SupportCard } from "@/components/support-card";
import { organizeAction } from "@/app/actions";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, lookupGear, GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { bestStyleAndSetup, calcDps, autoSetup, type DpsBreakdown } from "@/lib/dps";
import { cn, formatGp, ICON_URL } from "@/lib/utils";
import { BossDetailModal } from "@/components/boss-detail-modal";

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

  const run = (input: string, _junk: boolean, _rsn: string) => {
    setError(null);
    startTransition(async () => {
      const res = await organizeAction(input, { junkFilter: false, includePrices: false });
      if (res.error || !res.result) {
        setError(res.error || "Failed to read bank");
        return;
      }
      const flat = res.result.tabs.flatMap((t) => t.items);
      const gear = ownedGear(flat);
      setOwned(gear);
      setView("result");
      // Resolve the deep-linked boss now that we have a bank. If the
      // slug doesn't match any known boss (raid slug like 'cox' / 'tob'
      // / 'toa' falls through here — they're rooms-of-bosses in the
      // dps engine, no single target) we silently ignore.
      if (pendingBossSlug) {
        const target = BOSSES.find((b) => b.slug === pendingBossSlug);
        if (target) {
          setFocusedBoss(target);
          // Deep-link from /next or boss-showcase: open the full detail
          // modal immediately so the visitor lands directly on the
          // gear+stats+inventory view instead of having to find the row
          // and click again.
          setModalBoss(target);
        }
        setPendingBossSlug(null);
      }
    });
  };

  // For each boss, compute the best style/setup. We keep input order so the
  // table groups visually by category; the live search field above handles
  // discovery.
  const bossResults = useMemo(
    () => BOSSES.map((boss) => ({ boss, dps: bestStyleAndSetup(owned, boss) })),
    [owned]
  );

  // Find global upgrade suggestions — items the player doesn't have that would
  // improve DPS by the largest factor across most bosses.
  const upgrades = useMemo(() => suggestUpgrades(owned), [owned]);

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

  // Pretty name for the deep-linked boss banner (raid slugs fall through
  // — the banner just doesn't show in that case).
  const pendingBossName = useMemo(() => {
    if (!pendingBossSlug) return null;
    const b = BOSSES.find((x) => x.slug === pendingBossSlug);
    return b?.name ?? null;
  }, [pendingBossSlug]);

  if (view === "intake") {
    return (
      <>
        {pendingBossName && (
          <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-center gap-3 animate-[fade-in_0.3s_ease-out]">
            <Sword className="size-4 text-[var(--color-accent)] shrink-0" />
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              <span className="font-semibold">Paste your bank</span> and we&apos;ll jump straight to{" "}
              <span className="text-[var(--color-accent)]">{pendingBossName}</span>&apos;s best setup.
            </p>
          </div>
        )}
        <div className="mb-6 grid sm:grid-cols-3 gap-3">
          <FeatureCard
            icon={Sword}
            title="Best setup from YOUR bank"
            body="We pick your top weapon and accessories per boss — no manual gear input." />
          <FeatureCard
            icon={Target}
            title={`${BOSSES.length} bosses`}
            body="Vorkath, Zulrah, GWD bosses, demonics, Hydra, Sire, Skotizo — accurate stats." />
          <FeatureCard
            icon={TrendingUp}
            title="Upgrade path"
            body="See the 3 items that would speed up your kills the most." />
        </div>
        <Intake onSubmit={run} loading={pending} error={error} />
      </>
    );
  }

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      {/* Header */}
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)] mb-1">
            Gear recognized
          </div>
          <div className="text-3xl font-black text-[var(--color-gold)] leading-none tabular-nums">
            {owned.length}
          </div>
          <div className="text-[11.5px] text-[var(--color-text-dim)] mt-1">
            {owned.length === 0
              ? "We didn't recognise any combat gear in this bank."
              : `${owned.filter((g) => g.slot === "weapon").length} weapons in bank.`}
          </div>
        </div>
        <button
          onClick={() => { setView("intake"); setError(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px]",
            "bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)]",
            "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          )}
        >
          <Edit3 className="size-3.5" /> Edit input
        </button>
      </section>

      {/* Upgrade suggestions */}
      {upgrades.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-[var(--color-good)]" />
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-gold-soft)]">
              Biggest upgrades
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {upgrades.map((u) => (
              <div
                key={u.gear.id}
                className={cn(
                  "rounded-xl p-3 border border-[var(--color-good)]/30",
                  "bg-gradient-to-br from-[oklch(0.22_0.06_145/0.10)] to-[var(--color-bg-2)]"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={ICON_URL(u.gear.id)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="pixelated shrink-0 pointer-events-none"
                    style={{
                      maxWidth: "28px",
                      maxHeight: "28px",
                      width: "auto",
                      height: "auto",
                      imageRendering: "pixelated"
                    }}
                  />
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{u.gear.name}</span>
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] mb-1.5">
                  Adds <span className="text-[var(--color-good)] font-bold">+{u.avgGain.toFixed(1)} DPS</span> avg
                </div>
                <div className="text-[10.5px] text-[var(--color-text-dim)]">
                  Helps in: <span className="text-[var(--color-gold-soft)]">{u.bossLabels.slice(0, 3).join(", ")}</span>
                  {u.bossLabels.length > 3 && ` +${u.bossLabels.length - 3}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Boss table */}
      <section>
        <div className="mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-2">
            Per-boss DPS with your gear
          </h2>
          {/* Live search. Filters the rows below on every keystroke;
              ESC clears. The dropdown BossPicker is gone — for a table
              with 50+ rows, a real input field reads more directly than
              'click to open a hidden menu.' */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
                if (e.key === "Enter" && filteredResults.length > 0) {
                  // Open the first match directly in the detail modal —
                  // saves the user a follow-up click after typing.
                  setModalBoss(filteredResults[0].boss);
                }
              }}
              placeholder="Search bosses — type to filter, Enter to jump"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 focus:shadow-[0_0_0_3px_rgba(230,165,47,0.10)] text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-2)] transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
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
      id={`boss-${boss.slug}`}
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-xl border scroll-mt-24 p-3.5 flex items-center gap-4 flex-wrap",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border-[var(--color-border)]",
        "hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_0_1px_rgba(230,165,47,0.12)] transition-all cursor-pointer",
        isFocused && "border-[var(--color-accent)]/40 shadow-[0_0_0_1px_rgba(230,165,47,0.18)]"
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
        </>
      ) : (
        <div className="text-[12px] text-[var(--color-text-dim)] italic flex-1">
          No usable weapon in your bank for this boss.
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

function FeatureCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className={cn(
      "rounded-xl p-3.5 bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
      "border border-[var(--color-border)]"
    )}>
      <Icon className="size-4 text-[var(--color-gold-soft)] mb-2" />
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <p className="text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">{body}</p>
    </div>
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

// Boss thumbnail. Tries the local wiki portrait first
// (public/sprites/bosses/<slug>.png — populated by build:sprites), falls
// back to the drop-sprite that was shipping before, then to a neutral
// dot. The visual upgrade: the cell now shows what the boss actually
// looks like, not an item it drops.
function BossThumb({ boss }: { boss: Boss }) {
  const [stage, setStage] = useState<"portrait" | "drop" | "dot">("portrait");

  if (stage === "portrait") {
    return (
      <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
        <img
          src={`/sprites/bosses/${boss.slug}.png`}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setStage(boss.iconItemId ? "drop" : "dot")}
        />
      </div>
    );
  }
  if (stage === "drop" && boss.iconItemId) {
    return (
      <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center">
        <img
          src={ICON_URL(boss.iconItemId)}
          alt=""
          className="pixelated"
          style={{
            maxWidth: "78%",
            maxHeight: "78%",
            imageRendering: "pixelated",
            filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
          }}
          onError={() => setStage("dot")}
        />
      </div>
    );
  }
  return <span aria-hidden="true" className="size-9 shrink-0 rounded-full bg-[var(--color-text-muted)]/40 inline-block" />;
}
