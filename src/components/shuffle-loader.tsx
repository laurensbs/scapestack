"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";

// Shuffle loader — tijdens het laden van /next data hebben we tot ~2s
// vrijwel niets te tonen. Voor de wow-factor: een brede sweep waar
// kolommen item-sprites van links naar rechts "doorflippen" naar
// andere items. Voelt als data die de pagina in komt rollen.
//
// De grid:
//   - Volle breedte container, 12 kolommen × 2 rijen op desktop,
//     6 × 2 op mobiel (CSS auto-fit doet de keuze).
//   - Sweep loopt elke 60ms één kolom door — 12 kolommen = ~720ms
//     per sweep, dan herhaalt. Niet random meer; voelt direction-aware.
//   - Per cell: fade-out + scale-down → instant item-swap → fade-in
//     + scale-up via loader-cell-fade keyframe.
//
// Lore-quotes:
//   - rotate elke 3.5s
//   - één regel; iconisch & speels, niet preachy
//   - anti-repeat zodat dezelfde nooit 2x achter elkaar komt

// Iconische items + boss-trophy heads (Vorkath / Kraken / KBD / KQ /
// Cerberus / DT2 ingots / etc) zodat de speler "his world" voorbij ziet
// trekken. Mix van combat-gear, capes, drops, supplies en boss-trophies.
const ITEM_POOL = [
  // Combat capes + iconische gear
  4151,   // Abyssal whip
  21295,  // Infernal cape
  6570,   // Fire cape
  20997,  // Twisted bow
  12006,  // Kraken tentacle
  12904,  // Toxic staff (e)
  12936,  // Toxic blowpipe
  19553,  // Avernic defender
  11785,  // Bandos chestplate
  11804,  // Bandos tassets
  11862,  // Bandos boots
  4587,   // Dragon scimitar
  4153,   // Granite maul
  11920,  // Dharok's helm
  21015,  // Zenyte
  6739,   // Dragon axe
  19481,  // Heavy ballista
  11865,  // Black mask (i)
  11864,  // Slayer helmet (i)
  19722,  // Bow of faerdhinen
  // Capes & quest rewards
  9813,   // Quest point cape
  9948,   // Achievement diary cape
  13384,  // Max cape
  // Drops & trophies (boss-heads etc.)
  22006,  // Vorkath's head (mounted)
  11942,  // King Black Dragon head
  11944,  // Kalphite Queen head
  23047,  // Phoenix
  12655,  // KBD head loot
  21043,  // Hydra leather
  22325,  // Scythe of Vitur head
  // Supplies + economie
  995,    // Coins
  385,    // Shark
  3024,   // Super restore (4)
  12695,  // Super combat potion (4)
  12791,  // Rune pouch
  20720,  // Bond
  23979,  // Salve amulet (ei)
  21034,  // Brimstone key
  4585,   // Dragon chainbody
];

const LORE_QUOTES = [
  "It's safe to drop trade…",
  "0 attempts.",
  "Trust me bro.",
  "Skull yourself, it's faster.",
  "I'm building my bank back up.",
  "RNG manipulation isn't real (it's real).",
  "One more kill.",
  "Just one tick off PB.",
  "I'm only checking the GE.",
  "Mod Ash, fix Slayer.",
  "Almost broken, the bank is.",
  "Stake responsibly, kids.",
  "We do a little trolling.",
  "Pet luck > drop rate.",
  "10 hour Vorkath grind, no visage.",
  "I needed that for my zenyte.",
  "Pets count, right?",
  "Bring slash, bring stab.",
  "Have you tried turning RuneLite off and on again?",
  "Splash mage, the OG bot defense.",
];

interface ShuffleLoaderProps {
  /** Hoofd-tekst boven de grid. Default: 'Reading your account…' */
  label?: string;
}

// Aantal kolommen × 2 rijen — totaal 24 cells. ROW_COUNT × COL_COUNT
// bepaalt ook de sweep-snelheid: meer kolommen = langere sweep.
const COL_COUNT = 12;
const ROW_COUNT = 2;
const TOTAL_CELLS = COL_COUNT * ROW_COUNT;

export function ShuffleLoader({ label = "Reading your account…" }: ShuffleLoaderProps) {
  // Initial state: 24 willekeurige items (mogelijk repeats — pool is
  // kleiner dan grid). Memo zodat we niet bij elke render reshuffle'n.
  const initial = useMemo(() => {
    return Array.from({ length: TOTAL_CELLS }, () =>
      ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)]
    );
  }, []);
  const [cells, setCells] = useState<number[]>(initial);
  const [sweepCol, setSweepCol] = useState(0);  // welke kolom flippen we nu
  const [quote, setQuote] = useState(() => LORE_QUOTES[Math.floor(Math.random() * LORE_QUOTES.length)]);

  // Sweep-loop: elke 120ms één kolom doorflippen (alle ROW_COUNT cells
  // in die kolom). Na de laatste kolom: 200ms pauze, dan sweep opnieuw
  // van links. Total cycle = COL_COUNT × 120ms + pauze ≈ 1.6s. Voelt
  // als een continue golf, niet als losse flickers.
  useEffect(() => {
    const interval = setInterval(() => {
      setSweepCol((col) => {
        const nextCol = (col + 1) % COL_COUNT;
        // Update de cells in déze kolom met fresh random items
        setCells((prev) => {
          const next = [...prev];
          for (let row = 0; row < ROW_COUNT; row++) {
            const idx = row * COL_COUNT + col;
            // Pak een ander item dan wat er nu staat (anders voelt de
            // sweep onzichtbaar als hetzelfde item terugkomt)
            let nu = prev[idx];
            while (nu === prev[idx]) {
              nu = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
            }
            next[idx] = nu;
          }
          return next;
        });
        return nextCol;
      });
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Quote-rotation: elke 3.5s. Anti-repeat: niet 2x dezelfde achter elkaar.
  useEffect(() => {
    const interval = setInterval(() => {
      setQuote((current) => {
        let next = current;
        while (next === current) {
          next = LORE_QUOTES[Math.floor(Math.random() * LORE_QUOTES.length)];
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 py-8 px-2 w-full">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      {/* Volle-breedte sweep grid. Subtiele gradient-overlay van links
          naar rechts suggereert beweging zelfs als individuele cells
          stil zijn. */}
      <div
        className="relative w-full max-w-3xl rounded-xl bg-[var(--color-panel)] border border-[var(--color-border)] p-3 overflow-hidden"
        style={{ animation: "loader-pulse 2.4s ease-in-out infinite" }}
      >
        {/* Sweep-glow: een gouden tint die langzaam meeloopt met de
            actieve kolom. Pure cosmetic, voelt als spotlight. */}
        <div
          className="pointer-events-none absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-[var(--color-accent)]/15 to-transparent transition-transform duration-[120ms] ease-linear"
          style={{
            transform: `translateX(${(sweepCol / COL_COUNT) * 100}vw - 50%)`,
            left: `${(sweepCol / COL_COUNT) * 100}%`,
            marginLeft: "-4rem"
          }}
        />
        <div
          className="relative grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${COL_COUNT}, minmax(0, 1fr))` }}
        >
          {cells.map((itemId, i) => {
            const col = i % COL_COUNT;
            const isActive = col === sweepCol;
            return (
              <div
                key={`${i}-${itemId}`}
                className="aspect-square rounded bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden transition-all duration-300"
                style={{
                  // Active kolom: lichte highlight + scale, anders neutral.
                  // Niet keyframe-based zodat de overgang vloeiend interpoleert.
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  borderColor: isActive ? "var(--color-accent)" : undefined,
                  boxShadow: isActive
                    ? "0 0 12px rgba(230,165,47,0.25)"
                    : undefined
                }}
              >
                <ItemSprite
                  // key forceert React om de img te remount'en wanneer
                  // itemId verandert → fresh fade-in van loader-cell-fade.
                  key={itemId}
                  id={itemId}
                  alt=""
                  className="pixelated"
                  style={{
                    maxWidth: "78%",
                    maxHeight: "78%",
                    animation: "loader-cell-fade 0.45s ease-out both"
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* Lore quote — kruistabel-fade tussen oude en nieuwe quote.
          key={quote} forceert mount-cycle dus de animatie pakt opnieuw. */}
      <div className="h-6 flex items-center">
        <p
          key={quote}
          className="text-[12.5px] sm:text-[13px] italic text-[var(--color-text-dim)] text-center"
          style={{ animation: "fade-in 0.5s ease-out both" }}
        >
          “{quote}”
        </p>
      </div>
    </div>
  );
}
