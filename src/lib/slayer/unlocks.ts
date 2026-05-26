// Slayer Reward Shop entries — unlocks, blocks, extends, abilities.
//
// Bron: OSRS Wiki "Slayer reward unlocks" pagina, gecheckt 2026-05-26.
// `recommendedOrder` is mijn opinie voor een average player (combat
// 90+ doing main bosses). De simulator gebruikt dit voor de standaard
// "koop deze eerst" volgorde; gepersonaliseerde re-ranking komt
// wanneer plugin-data binnenkomt.

import type { SlayerUnlock } from "./types";

export const UNLOCKS: SlayerUnlock[] = [
  // ---------- Top-priority unlocks (every slayer wants these) ----------
  {
    id: "bigger_and_badder",
    name: "Bigger and Badder",
    cost: 150,
    category: "ability",
    effect: "Toggle: chance op superior slayer monster (better XP + uniques).",
    recommendedOrder: 1
  },
  {
    id: "broader_fletching",
    name: "Broader Fletching",
    cost: 300,
    category: "unlock",
    effect: "Vletch broad arrows/bolts; cannonball-alternatief voor ranged training.",
    recommendedOrder: 9
  },
  {
    id: "malevolent_masquerade",
    name: "Malevolent Masquerade",
    cost: 400,
    category: "unlock",
    effect: "Maak masks: black mask → slayer helm + Hydra helm (na alch hydra).",
    recommendedOrder: 2
  },
  {
    id: "use_more_than_one_cannon",
    name: "Like a boss",
    cost: 200,
    category: "ability",
    effect: "Toggle: krijg meer boss-tasks van masters.",
    recommendedOrder: 8
  },
  {
    id: "ring_bling",
    name: "Ring bling",
    cost: 300,
    category: "unlock",
    effect: "Maak ring of slaying op anvil — krijgt teleport-charges.",
    recommendedOrder: 11
  },
  {
    id: "slug_salt",
    name: "Slug salty",
    cost: 50,
    category: "unlock",
    effect: "Maak bag of salt op anvil ipv mining-shopping.",
    recommendedOrder: 14
  },
  {
    id: "i_hope_you_mith_me",
    name: "I hope you mith me",
    cost: 100,
    category: "unlock",
    effect: "Mith-grindel kunnen mining bij Lletya-mineraalstort.",
    recommendedOrder: 16
  },
  {
    id: "rev_my_engine",
    name: "Rev my engine",
    cost: 100,
    category: "unlock",
    effect: "Maak rune en/of dragon spit voor revenant cave key-crafting.",
    recommendedOrder: 17
  },

  // ---------- Boss-task unlocks (gates) ----------
  {
    id: "basilocked",
    name: "Basilocked",
    cost: 80,
    category: "unlock",
    effect: "Unlock Basilisk knights als task (vereist Bone Voyage).",
    recommendedOrder: 6
  },
  {
    id: "actual_vampyre_slayer",
    name: "Actual vampyre slayer",
    cost: 80,
    category: "unlock",
    effect: "Unlock Vyrewatch (tier 3 vampyre) tasks van Duradel/Nieve.",
    recommendedOrder: 7
  },
  {
    id: "augment_my_abyss",
    name: "Augment my abyss",
    cost: 200,
    category: "unlock",
    effect: "Unlock Abyssal Sire als boss task (vereist abyss-toegang).",
    recommendedOrder: 4
  },
  {
    id: "reptile_got_ripped",
    name: "Reptile got ripped",
    cost: 75,
    category: "unlock",
    effect: "Unlock Lizardmen als task (Konar + Duradel/Nieve).",
    recommendedOrder: 5
  },
  {
    id: "hot_stuff",
    name: "Hot stuff",
    cost: 100,
    category: "unlock",
    effect: "Unlock Cerberus als boss task voor Konar/Duradel/Nieve.",
    recommendedOrder: 3
  },
  {
    id: "stop_the_wyvern",
    name: "Stop the Wyvern",
    cost: 100,
    category: "unlock",
    effect: "Unlock Skeletal wyverns (vereist 72 slayer).",
    recommendedOrder: 12
  },

  // ---------- XP / convenience ----------
  {
    id: "warped_reality",
    name: "Warped Reality",
    cost: 100,
    category: "unlock",
    effect: "Toggle om Warped creatures te krijgen (pre-MEP2 alternative).",
    recommendedOrder: 18
  },
  {
    id: "seeing_red",
    name: "Seeing red",
    cost: 50,
    category: "unlock",
    effect: "Vletch red chinchompas voor ranged op skeletal wyverns.",
    recommendedOrder: 19
  },
  {
    id: "smell_ya_later",
    name: "Smell ya later",
    cost: 80,
    category: "unlock",
    effect: "Toggle slayer-helm stink (alleen cosmetic).",
    recommendedOrder: 20
  },

  // ---------- Blocks ----------
  // Geen vaste cost — initiele block-slots (5 max) zijn gratis;
  // 6e slot kost 100, 7e 200 etc. We surfacen alleen het concept.
  {
    id: "block_slot_6",
    name: "6th block slot",
    cost: 100,
    category: "block",
    effect: "Extra task-block; vooral nuttig om Spiritual creatures + Aviansies te blokken.",
    recommendedOrder: 10
  },

  // ---------- Extends ----------
  {
    id: "extend_lizardman",
    name: "Extended: Lizardman",
    cost: 75,
    category: "extend",
    effect: "Verhoog task-quantity met +20 voor Lizardman; extra punten bij voltooien.",
    recommendedOrder: 13
  },
  {
    id: "extend_aviansie",
    name: "Extended: Aviansie",
    cost: 75,
    category: "extend",
    effect: "+20 task-quantity, +extra punten bij voltooien.",
    recommendedOrder: 15
  }
];

/** Lookup-table for O(1) shop-entry lookup. */
export const UNLOCKS_BY_ID = new Map(UNLOCKS.map((u) => [u.id, u]));

/** Suggested purchase order. Lower number = buy first. Onbekende
 *  recommendedOrder belandt achteraan. */
export function recommendedOrder(): SlayerUnlock[] {
  return [...UNLOCKS].sort((a, b) => {
    const aN = a.recommendedOrder ?? 1000;
    const bN = b.recommendedOrder ?? 1000;
    return aN - bN;
  });
}
