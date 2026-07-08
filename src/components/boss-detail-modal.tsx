"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Sword, Target, Zap, TrendingUp, Package, ExternalLink } from "lucide-react";
import { BOSSES, type Boss } from "@/lib/bosses";
import { bestStyleAndSetup, calcDps, autoSetup, type DpsBreakdown, type Setup } from "@/lib/dps";
import { GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { PRESETS, type Preset } from "@/lib/presets";
import { formatGp, cn } from "@/lib/utils";
import { ItemSprite } from "@/components/item-sprite";
import { BossSprite } from "@/components/boss-picker";
import { wikiPriceUrl } from "@/lib/item-action";
import { wikiSearchUrl } from "@/lib/wiki";
import type { BankHandoffItem } from "@/lib/next-bank-handoff";

interface Props {
  boss: Boss;
  owned: GearItem[];
  bankItems?: BankHandoffItem[];
  onClose: () => void;
  onSelectBoss?: (boss: Boss) => void;
}

// Full-bleed boss profile modal. Triggered from /dps (row click) and
// /next (KC-rec portrait click). Layout is side-by-side on desktop —
// big portrait left 60%, gear+stats+upgrades+inventory right — and
// stacks on mobile.
export function BossDetailModal({ boss, owned, bankItems = [], onClose, onSelectBoss }: Props) {
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
  const inventoryRows = useMemo(
    () => buildInventoryRows({ preset, bankItems, owned, dps }),
    [preset, bankItems, owned, dps]
  );
  const nearbyBosses = useMemo(() => {
    const sameCategory = BOSSES.filter((candidate) => candidate.category === boss.category && candidate.slug !== boss.slug);
    const rest = BOSSES.filter((candidate) => candidate.category !== boss.category && candidate.slug !== boss.slug);
    return [...sameCategory, ...rest].slice(0, 12);
  }, [boss]);

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
        className="relative grid max-h-[90vh] min-h-0 w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_30px_80px_-12px_rgb(0_0_0/0.85)] lg:grid-cols-[3fr_2fr]"
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
        <div className="relative min-h-0 max-h-[90vh] space-y-5 overflow-y-auto overscroll-contain p-5 pb-16 sm:p-6 sm:pb-16">
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

          {onSelectBoss && nearbyBosses.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="eyebrow text-[var(--color-text-muted)]">Try another boss</h3>
                <span className="text-[10.5px] text-[var(--color-text-muted)]">{nearbyBosses.length} quick picks</span>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {nearbyBosses.map((candidate) => (
                  <button
                    key={candidate.slug}
                    type="button"
                    onClick={() => onSelectBoss(candidate)}
                    title={candidate.name}
                    aria-label={`Switch boss setup to ${candidate.name}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 transition-colors hover:border-[var(--color-accent)]/55 hover:bg-[var(--color-accent)]/10"
                  >
                    <BossSprite boss={candidate} size={36} />
                  </button>
                ))}
              </div>
            </section>
          )}

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
                      <div className="flex shrink-0 flex-col gap-1">
                        <a
                          href={wikiSearchUrl(u.item.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                          aria-label={`Open ${u.item.name} on the OSRS Wiki`}
                        >
                          Wiki <ExternalLink className="size-2.5" />
                        </a>
                        <a
                          href={wikiPriceUrl(u.item.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded border border-[var(--color-accent)]/25 px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/45"
                          aria-label={`Open ${u.item.name} GE price`}
                        >
                          GE <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Inventory loadout — built from boss presets when available,
              then matched against the full pasted bank. Missing slots stay
              visible as buy/check chips so the player knows what to fix. */}
          {inventoryRows.length > 0 && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Package className="size-3 inline-block mr-1" />Best inventory setup
              </h3>
              <div className="space-y-2.5">
                {inventoryRows.map((row) => (
                  <div key={row.label}>
                    <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">
                      {row.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.slots.map((slot, i) => {
                        return (
                          <a
                            key={`${row.label}-${i}-${slot.label}`}
                            href={slot.item ? wikiSearchUrl(slot.item.name) : wikiSearchUrl(slot.label)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors",
                              slot.item
                                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-text)]"
                                : "bg-[var(--color-bg-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                            )}
                            title={slot.item ? `${slot.item.name}: ${slot.item.quantity.toLocaleString()} in bank` : `${slot.label}: missing from bank`}
                          >
                            {slot.item ? (
                              <ItemSprite
                                id={slot.item.id}
                                alt=""
                                size={14}
                                className="pixelated"
                              />
                            ) : (
                              <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent)]">
                                Buy
                              </span>
                            )}
                            <span className="truncate max-w-[155px]">{slot.item?.name ?? slot.label}</span>
                            {slot.item && slot.item.quantity > 1 && (
                              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                                x{slot.item.quantity.toLocaleString()}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)] italic">
                Bright chips = in your bank. Buy chips = missing or too specific to detect from this paste.
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

interface InventorySlotPick {
  label: string;
  item: BankHandoffItem | null;
}

interface InventoryRowPick {
  label: string;
  slots: InventorySlotPick[];
}

const FOOD_PATTERNS = [
  /^anglerfish$/i,
  /^manta ray$/i,
  /^shark$/i,
  /^cooked karambwan$/i,
  /^monkfish$/i,
  /^karambwan$/i
] as const;

const PRAYER_PATTERNS = [
  /^super restore\(4\)$/i,
  /^prayer potion\(4\)$/i,
  /^sanfew serum\(4\)$/i
] as const;

const TELEPORT_PATTERNS = [
  /^royal seed pod$/i,
  /^teleport to house$/i,
  /^house teleport$/i,
  /^varrock teleport$/i,
  /^falador teleport$/i,
  /^camelot teleport$/i,
  /^ardougne teleport$/i,
  /^ring of dueling/i,
  /^games necklace/i,
  /^amulet of glory/i
] as const;

const STYLE_BOOSTS: Record<CombatStyle, { label: string; patterns: readonly RegExp[] }> = {
  stab: {
    label: "Super combat potion(4)",
    patterns: [/^super combat potion\(4\)$/i, /^super attack\(4\)$/i]
  },
  slash: {
    label: "Super combat potion(4)",
    patterns: [/^super combat potion\(4\)$/i, /^super strength\(4\)$/i, /^super attack\(4\)$/i]
  },
  crush: {
    label: "Super combat potion(4)",
    patterns: [/^super combat potion\(4\)$/i, /^super strength\(4\)$/i, /^super attack\(4\)$/i]
  },
  ranged: {
    label: "Ranging potion(4)",
    patterns: [/^ranging potion\(4\)$/i, /^bastion potion\(4\)$/i]
  },
  magic: {
    label: "Magic potion(4)",
    patterns: [/^magic potion\(4\)$/i, /^forgotten brew\(4\)$/i, /^imbued heart$/i]
  }
};

function buildInventoryRows({
  preset,
  bankItems,
  owned,
  dps
}: {
  preset: Preset | undefined;
  bankItems: BankHandoffItem[];
  owned: GearItem[];
  dps: DpsBreakdown;
}): InventoryRowPick[] {
  if (preset) {
    const rows = preset.rows.map((row) => ({
      label: row.label,
      slots: row.patterns.map((pattern) => ({
        label: describePattern(pattern),
        item: findBankItemByPattern(pattern, bankItems, owned)
      }))
    }));
    const extras = fallbackInventorySlots(bankItems, owned, dps)
      .filter((slot) => slot.label === "Food" || slot.label === "Teleport out")
      .filter((slot) => !inventoryRowsContain(rows, slot));
    return extras.length > 0 ? [...rows, { label: "Extra supplies", slots: extras }] : rows;
  }

  return [{ label: "Inventory", slots: fallbackInventorySlots(bankItems, owned, dps) }];
}

function fallbackInventorySlots(
  bankItems: BankHandoffItem[],
  owned: GearItem[],
  dps: DpsBreakdown
): InventorySlotPick[] {
  const styleBoost = STYLE_BOOSTS[dps.style];
  return [
    {
      label: dps.dps > 0 ? dps.weapon.name : "Usable weapon",
      item: dps.dps > 0 ? bankItemFromGear(dps.weapon, bankItems) : null
    },
    { label: styleBoost.label, item: firstBankMatch(styleBoost.patterns, bankItems) },
    { label: "Prayer restore", item: firstBankMatch(PRAYER_PATTERNS, bankItems) },
    { label: "Food", item: firstBankMatch(FOOD_PATTERNS, bankItems) },
    { label: "Teleport out", item: firstBankMatch(TELEPORT_PATTERNS, bankItems) }
  ].filter((slot) => slot.item || slot.label !== "Usable weapon" || owned.length === 0);
}

function inventoryRowsContain(rows: InventoryRowPick[], slot: InventorySlotPick): boolean {
  const needle = (slot.item?.name ?? slot.label).toLowerCase();
  return rows.some((row) =>
    row.slots.some((existing) => (existing.item?.name ?? existing.label).toLowerCase() === needle)
  );
}

function firstBankMatch(patterns: readonly RegExp[], bankItems: BankHandoffItem[]): BankHandoffItem | null {
  for (const pattern of patterns) {
    const item = bankItems.find((candidate) => patternMatches(pattern, candidate.name));
    if (item) return item;
  }
  return null;
}

function findBankItemByPattern(
  pattern: RegExp,
  bankItems: BankHandoffItem[],
  owned: GearItem[]
): BankHandoffItem | null {
  const bankMatch = bankItems.find((item) => patternMatches(pattern, item.name));
  if (bankMatch) return bankMatch;
  const gearMatch = owned.find((item) => patternMatches(pattern, item.name));
  return gearMatch ? bankItemFromGear(gearMatch, bankItems) : null;
}

function patternMatches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function bankItemFromGear(gear: GearItem, bankItems: BankHandoffItem[]): BankHandoffItem {
  return bankItems.find((item) => item.id === gear.id || item.name.toLowerCase() === gear.name.toLowerCase()) ?? {
    id: gear.id,
    name: gear.name,
    quantity: 1,
    unitPrice: 0,
    stackValue: 0,
    subtab: "Gear",
    slot: gear.slot,
    weight: 0
  };
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
