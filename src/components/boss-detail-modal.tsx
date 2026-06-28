"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Sword, Target, Zap, TrendingUp, Package } from "lucide-react";
import type { Boss } from "@/lib/bosses";
import { bestStyleAndSetup, calcDps, autoSetup, type DpsBreakdown, type Setup } from "@/lib/dps";
import { GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { PRESETS } from "@/lib/presets";
import { formatGp, cn } from "@/lib/utils";
import { ItemSprite } from "@/components/item-sprite";

interface Props {
  boss: Boss;
  owned: GearItem[];
  onClose: () => void;
}

// Full-bleed boss profile modal. Triggered from /dps (row click) and
// /next (KC-rec portrait click). Layout is side-by-side on desktop —
// big portrait left 60%, gear+stats+upgrades+inventory right — and
// stacks on mobile.
export function BossDetailModal({ boss, owned, onClose }: Props) {
  const titleId = "boss-modal-title";
  const descriptionId = "boss-modal-description";
  const statsId = "boss-modal-stats";
  // a11y: Esc closes, body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dps = useMemo(() => bestStyleAndSetup(owned, boss), [owned, boss]);
  const upgrades = useMemo(() => suggestUpgradesForBoss(owned, boss, dps), [owned, boss, dps]);
  const preset = useMemo(() => PRESETS.find((p) => p.slug === boss.slug), [boss]);

  // GP/hr is honest: cap kills/hour at the boss's killsPerHourCap. Skipped
  // when the engine couldn't find a usable weapon (dps === 0).
  const gpPerHour = dps.dps > 0 && boss.avgLootGp && boss.killsPerHourCap
    ? Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp
    : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${statsId}`}
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      <button
        type="button"
        aria-label={`Close ${boss.name} boss setup details`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(7,9,12,0.82)] backdrop-blur-sm cursor-default"
      />

      <div
        className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden bg-[var(--color-panel)] border border-[var(--color-border-strong)] shadow-[0_30px_80px_-12px_rgb(0_0_0/0.85)] grid lg:grid-cols-[3fr_2fr]"
        style={{ animation: "pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Close — floats top-right over the portrait so it stays visible
            even when the portrait is dark in that corner. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${boss.name} boss setup details`}
          className="absolute top-3 right-3 z-10 size-9 rounded-full flex items-center justify-center bg-[var(--color-bg)]/70 backdrop-blur border border-[var(--color-border-strong)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Left column — portrait. Full-bleed within its column, no frame
            (matches the homepage showcase treatment). Drop-shadow gives
            it weight against the panel background. */}
        <div className="relative bg-[var(--color-bg-2)] aspect-square lg:aspect-auto min-h-[280px] flex items-center justify-center p-6 overflow-hidden">
          <div
            className="absolute inset-[-10%] pointer-events-none"
            style={{
              background: "radial-gradient(closest-side, rgba(134, 166, 217, 0.18) 0%, transparent 70%)",
              opacity: 0.5
            }}
          />
          <img
            src={`/sprites/bosses/${boss.slug}.png`}
            alt=""
            className="relative w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.55))" }}
          />
          {/* Title overlay along the bottom-left. Big enough to be the
              page hero, low-contrast bg-tint so it doesn't fight the boss. */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <h2
              id={titleId}
              className="text-[24px] sm:text-[28px] font-bold tracking-normal text-[var(--color-text)] leading-tight"
              style={{ textShadow: "0 2px 12px rgb(0 0 0 / 0.6)" }}
            >
              {boss.name}
            </h2>
            <p id={descriptionId} className="mt-0.5 text-[12px] text-[var(--color-text-dim)]" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.7)" }}>
              {boss.hp} HP{boss.notes ? ` · ${boss.notes}` : ""}
            </p>
          </div>
        </div>

        {/* Right column — gear, stats, upgrades, inventory. Scrolls
            internally so the modal as a whole stays in viewport. */}
        <div className="relative overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Stats row — DPS, Max hit, Accuracy, plus GP/hr if available. */}
          <section id={statsId}>
            <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">Best style with your gear</h3>
            {dps.dps > 0 ? (
              <>
                <div className="text-[13px] text-[var(--color-text-dim)] mb-3">
                  Recommended:{" "}
                  <span className="text-[var(--color-accent)] font-semibold uppercase tracking-wider">{dps.style}</span>
                  {" with "}
                  <span className="text-[var(--color-text)] font-semibold">{dps.weapon.name}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="DPS"      value={dps.dps.toFixed(1)} />
                  <Stat label="Max hit"  value={String(dps.maxHit)} />
                  <Stat label="Accuracy" value={`${Math.round(dps.hitChance * 100)}%`} />
                  {dps.ttk > 0 && (
                    <Stat
                      label="Kc/u"
                      value={String(Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / dps.ttk)))}
                    />
                  )}
                </div>
                {gpPerHour !== null && (
                  <div className="mt-2 text-[12px] text-[var(--color-text-dim)] flex items-center gap-1.5">
                    <TrendingUp className="size-3.5 text-[var(--color-accent)]" />
                    Est. <span className="text-[var(--color-text)] font-mono tabular-nums">{formatGp(gpPerHour)}</span>/hr
                    {boss.killsPerHourCap !== undefined && Math.floor(3600 / dps.ttk) > boss.killsPerHourCap && (
                      <span className="text-[var(--color-text-muted)]"> (capped at {boss.killsPerHourCap} kills/hr)</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[var(--color-warning)]">
                Your bank doesn&apos;t carry a weapon that works against this boss yet — check the upgrades below.
              </p>
            )}
          </section>

          {/* Worn gear grid — 8 slots in the OSRS equipment-tab layout
              (best-fit since we don't model 11 slots; missing slots
              render as empty cells). */}
          <section>
            <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
              <Sword className="size-3 inline-block mr-1" />Best setup
            </h3>
            <GearSlotGrid setup={dps.setup} />
          </section>

          {/* Upgrades — top 3 items the player doesn't own that would
              raise DPS the most for THIS boss specifically (not the
              global suggestion the page already shows up top). */}
          {upgrades.length > 0 && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Target className="size-3 inline-block mr-1" />Upgrades you don&apos;t have
              </h3>
              <div className="space-y-1.5">
                {upgrades.map((u) => {
                  // Vertaal DPS-gain naar concrete impact: kills/uur erbij +
                  // GP/uur erbij. Gebruikt dezelfde kph-cap als de hoofdrij.
                  const currentKph = dps.ttk > 0 ? Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / dps.ttk)) : 0;
                  const newKph = u.newTtk > 0 ? Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / u.newTtk)) : 0;
                  const kphGain = Math.max(0, newKph - currentKph);
                  const gpGain = kphGain && boss.avgLootGp ? kphGain * boss.avgLootGp : 0;
                  return (
                    <div
                      key={u.item.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)]"
                    >
                      <div className="size-8 shrink-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                        <ItemSprite
                          id={u.item.id}
                          alt=""
                          className="pixelated"
                          style={{ maxWidth: "78%", maxHeight: "78%" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">{u.item.name}</div>
                        <div className="text-[10.5px] text-[var(--color-text-muted)] tabular-nums">
                          <span className="text-[var(--color-good)]">+{u.gain.toFixed(2)} DPS</span>
                          {kphGain > 0 && (
                            <> · <span className="text-[var(--color-text-dim)]">+{kphGain} kc/u</span></>
                          )}
                          {gpGain > 0 && (
                            <> · <span className="text-[var(--color-text-dim)]">+{(gpGain / 1000).toFixed(0)}k GP/u</span></>
                          )}
                          {" · "}{u.item.slot ?? "weapon"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Inventory loadout — pulled from PRESETS if the boss has one.
              Shows the standard 'what to take with you' list. Not all
              bosses have presets; we hide the whole section then. */}
          {preset && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Package className="size-3 inline-block mr-1" />Bring with you
              </h3>
              <div className="space-y-2.5">
                {preset.rows.map((row) => (
                  <div key={row.label}>
                    <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">
                      {row.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.patterns.map((re, i) => {
                        const owned_match = owned.find((g) => re.test(g.name));
                        const label = describePattern(re);
                        return (
                          <div
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border",
                              owned_match
                                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-text)]"
                                : "bg-[var(--color-bg-2)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                            )}
                            title={owned_match ? owned_match.name : "Not in your bank"}
                          >
                            {owned_match && (
                              <ItemSprite
                                id={owned_match.id}
                                alt=""
                                size={14}
                                className="pixelated"
                              />
                            )}
                            <span className="truncate max-w-[140px]">{owned_match?.name ?? label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)] italic">
                Bright chips = you have it. Dim chips = pattern matches nothing in your bank yet.
              </p>
            </section>
          )}

          <p className="text-[10.5px] text-[var(--color-text-muted)] italic pt-3 border-t border-[var(--color-border)]">
            DPS at level 99 stats with full offensive prayer. Boss-specific mechanics not modelled.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="text-[18px] font-bold text-[var(--color-text)] font-mono tabular-nums leading-tight">{value}</div>
    </div>
  );
}

// 4×2 grid of gear slots. Each slot shows the item's sprite (or empty
// placeholder if not equipped/available). Slot order matches the OSRS
// equipment tab layout roughly: top row = head/cape/neck/ammo,
// bottom row = weapon/body/shield/legs/hands/feet/ring.
function GearSlotGrid({ setup }: { setup: Setup }) {
  const slots: Array<{ key: keyof Setup; label: string }> = [
    { key: "head",   label: "Head" },
    { key: "cape",   label: "Cape" },
    { key: "neck",   label: "Neck" },
    { key: "ammo",   label: "Ammo" },
    { key: "weapon", label: "Weapon" },
    { key: "body",   label: "Body" },
    { key: "shield", label: "Shield" },
    { key: "legs",   label: "Legs" },
    { key: "hands",  label: "Hands" },
    { key: "feet",   label: "Feet" },
    { key: "ring",   label: "Ring" }
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {slots.map(({ key, label }) => {
        const item = setup[key];
        return (
          <div
            key={key}
            title={item ? item.name : `${label} (empty)`}
            className={cn(
              "aspect-square rounded-md border flex items-center justify-center relative overflow-hidden",
              item
                ? "bg-[var(--color-bg)] border-[var(--color-border)]"
                : "bg-[var(--color-bg-2)]/40 border-dashed border-[var(--color-border)]/60"
            )}
          >
            {item ? (
              <ItemSprite
                id={item.id}
                alt=""
                className="pixelated"
                style={{ maxWidth: "75%", maxHeight: "75%" }}
              />
            ) : (
              <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]/50">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UpgradePick {
  item: GearItem;
  gain: number;     // DPS gain over current best setup at this boss
  /** TTK (seconds per kill) met deze upgrade. Gebruikt om kc/u en
   *  GP/u te tonen — meer concreet dan "DPS +0.5". */
  newTtk: number;
}

// Per-boss upgrade picker. Tries each unowned gear item against the
// boss's best style; keeps the three with the biggest DPS gain. This
// is cheaper than the global suggester because we only test one
// boss + one style.
function suggestUpgradesForBoss(owned: GearItem[], boss: Boss, current: DpsBreakdown): UpgradePick[] {
  if (current.dps === 0) return [];
  const ownedIds = new Set(owned.map((g) => g.id));
  const style: CombatStyle = current.style;
  const baseDps = current.dps;
  const candidates: UpgradePick[] = [];
  for (const g of GEAR) {
    if (ownedIds.has(g.id)) continue;
    // Style-bound weapons only count for their own style.
    if (g.slot === "weapon" && g.weaponStyle && g.weaponStyle !== style) continue;
    const newSetup = autoSetup([...owned, g], style);
    if (!newSetup.weapon) continue;
    const newCalc = calcDps(newSetup, boss, style);
    const gain = newCalc.dps - baseDps;
    if (gain > 0.1) {
      candidates.push({ item: g, gain, newTtk: newCalc.ttk });
    }
  }
  return candidates.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

// Pretty-print a preset pattern so the chip reads as 'Twisted bow' rather
// than '/^twisted bow|^toxic blowpipe/i'. Best-effort — picks the first
// alternative in the pattern source.
function describePattern(re: RegExp): string {
  const src = re.source;
  // Strip ^ / $ / (?i) and leading slashes, take first | alternative.
  const first = src.replace(/^\^|\$$/g, "").split("|")[0]
    .replace(/\\\^|\\\$/g, "")
    .replace(/[()]/g, "")
    .trim();
  // Title-case for display
  return first.replace(/\b\w/g, (c) => c.toUpperCase());
}
