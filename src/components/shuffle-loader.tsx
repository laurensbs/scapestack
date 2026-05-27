"use client";

import { useEffect, useMemo, useState } from "react";
import { ICON_URL } from "@/lib/utils";

// Shuffle loader — tijdens het laden van /next data hebben we tot ~2s
// vrijwel niets te tonen. In plaats van een lege spinner: een 4×4 grid
// van iconische OSRS item-sprites die continu schuifelen + draaien,
// met onder de grid een rotating "lore quote." Voelt als de game
// die aan't denken is.
//
// De grid:
//   - 16 vakjes, willekeurig gevuld uit ITEM_POOL
//   - elke 600ms: pak 4-6 random vakjes en wissel hun items uit met
//     andere items uit de pool. Item-swap met fade-out → fade-in.
//   - subtiele scale-pulse op de hele grid om "denken" te suggereren
//
// Lore-quotes:
//   - rotate elke 3.5s
//   - één regel; iconisch & speels, niet preachy
//   - gewogen pool zodat 'It's safe to drop trade…' niet 5 keer komt

const ITEM_POOL = [
  4151,   // Abyssal whip
  995,    // Coins
  9813,   // Quest point cape
  21295,  // Infernal cape
  22006,  // Vorkath's head
  6739,   // Dragon axe
  11864,  // Slayer helmet (i)
  11785,  // Bandos chestplate
  21015,  // Demonic gorilla drop (zenyte)
  20997,  // Twisted bow
  11920,  // Dharok's helm
  4587,   // Dragon scimitar
  11865,  // Black mask (i)
  385,    // Shark
  3024,   // Super restore (4)
  12695,  // Super combat potion (4)
  12791,  // Rune pouch
  12936,  // Toxic blowpipe
  19553,  // Avernic defender
  6570,   // Fire cape
  20720,  // Bond
  11862,  // Bandos boots
  23979,  // Salve amulet (ei)
  4153,   // Granite maul
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

export function ShuffleLoader({ label = "Reading your account…" }: ShuffleLoaderProps) {
  // Pak 16 willekeurige unique items als startgrid.
  const initial = useMemo(() => {
    const pool = [...ITEM_POOL].sort(() => Math.random() - 0.5);
    return pool.slice(0, 16);
  }, []);
  const [cells, setCells] = useState<number[]>(initial);
  const [quote, setQuote] = useState(() => LORE_QUOTES[Math.floor(Math.random() * LORE_QUOTES.length)]);
  // tickCounter forceert key-changes op cells zodat React de fade-keyframe
  // herapply't elke shuffle-cyclus.
  const [tick, setTick] = useState(0);

  // Shuffle-loop: elke 700ms wissel je 5 random cells met andere items
  // uit de pool. Niet alle 16 tegelijk — anders voelt het te chaotisch.
  useEffect(() => {
    const interval = setInterval(() => {
      setCells((prev) => {
        const next = [...prev];
        const swapsCount = 4 + Math.floor(Math.random() * 3); // 4..6
        for (let i = 0; i < swapsCount; i++) {
          const idx = Math.floor(Math.random() * next.length);
          const newItem = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
          next[idx] = newItem;
        }
        return next;
      });
      setTick((t) => t + 1);
    }, 700);
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
    <div className="flex flex-col items-center gap-5 py-6 px-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      {/* 4×4 grid. Pulse op het geheel, fade per cell wanneer item flipt. */}
      <div
        className="grid grid-cols-4 gap-1.5 p-3 rounded-xl bg-[var(--color-panel)] border border-[var(--color-border)]"
        style={{ animation: "loader-pulse 2s ease-in-out infinite" }}
      >
        {cells.map((itemId, i) => (
          <div
            key={`${i}-${itemId}-${tick}`}
            className="size-9 sm:size-10 rounded bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden"
            style={{ animation: "loader-cell-fade 0.7s ease-out both" }}
          >
            <img
              src={ICON_URL(itemId)}
              alt=""
              className="pixelated"
              style={{
                maxWidth: "78%",
                maxHeight: "78%",
                imageRendering: "pixelated",
                filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))",
                objectFit: "contain"
              }}
            />
          </div>
        ))}
      </div>
      {/* Lore quote — kruistabel-fade tussen oude en nieuwe quote.
          key={quote} forceert mount-cycle dus de animatie pakt opnieuw. */}
      <div className="h-5 flex items-center">
        <p
          key={quote}
          className="text-[12.5px] italic text-[var(--color-text-dim)]"
          style={{ animation: "fade-in 0.5s ease-out both" }}
        >
          “{quote}”
        </p>
      </div>
    </div>
  );
}
