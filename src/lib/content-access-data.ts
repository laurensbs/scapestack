// Which unlock stands between the player and this content.
//
// Curation rule: only list a gate we are certain about. A wrong gate suppresses
// content the player *can* do, which is the same class of mistake as
// recommending content they cannot — it just fails quietly instead of loudly.
// Content with no entry here is treated as reachable by anyone who meets the
// skill requirements, which is the honest default for most of the game.
//
// Quest names must match data/quests.json exactly; tests assert that. Because
// that file carries full transitive `questReqs`, naming the final quest is
// enough — we never restate the chain below it.

import type { AccessRequirement } from "./content-access";

/** Keyed by MoneyMethod.slug. */
export const MONEY_ACCESS: Record<string, AccessRequirement> = {
  // Blast Furnace is only usable after The Giant Dwarf.
  "blast-furnace": { quests: ["The Giant Dwarf"] },

  // Zul-Andra sits past the Underground Pass, opened by Regicide.
  "zulrah": { quests: ["Regicide"] },

  // Vorkath and the rune dragons both arrive with Dragon Slayer II.
  "vorkath": { quests: ["Dragon Slayer II"] },
  "rune-dragons": { quests: ["Dragon Slayer II"] },

  // The Wrath altar sits on the Myths' Guild island — DS2, not Mourning's End.
  // (Mourning's End Part II gates the Death altar, which we do not list.)
  "wrath-runes": { quests: ["Dragon Slayer II"] },

  // Blood altar: Sins of the Father is the modern route; before that it needs
  // full Arceuus favour, which we cannot see either way.
  "blood-runes": { quests: ["Sins of the Father"], favour: { house: "Arceuus", percent: 100 } },

  // Fossil Island content — both need Bone Voyage.
  "birdhouses": { quests: ["Bone Voyage"] },
  "tree-runs": { quests: ["Bone Voyage"] },

  // Kourend favour. Never verifiable, so these stay conditions, not blockers.
  "redwood-cut": { favour: { house: "Hosidius", percent: 75 } },
  "tithe-farm": { favour: { house: "Hosidius", percent: 100 } },
  "farming-contracts": { favour: { house: "Hosidius", percent: 45 } }

  // Deliberately ungated: herb runs (the basic patches need nothing), moss
  // giants, amethyst mining (Mining Guild is a level gate), and Wines of
  // Zamorak (telegrab is a Magic level).
};

/** Keyed by boss slug, matching BOSS_CL_GATE / bosses.ts. */
export const BOSS_ACCESS: Record<string, AccessRequirement> = {
  // Crossing the Salve needs Priest in Peril.
  "barrows": { quests: ["Priest in Peril"] },

  "vorkath": { quests: ["Dragon Slayer II"] },
  "zulrah": { quests: ["Regicide"] },
  "demonic-gorillas": { quests: ["Monkey Madness II"] },
  "phantom-muspah": { quests: ["Secrets of the North"] },

  // God Wars Dungeon is reached over Trollheim.
  "graardor": { quests: ["Troll Stronghold"] },
  "kree": { quests: ["Troll Stronghold"] },
  "zilyana": { quests: ["Troll Stronghold"] },
  "kril": { quests: ["Troll Stronghold"] },
  "nex": { quests: ["Troll Stronghold"] },

  // Waterbirth Island travel opens with the Fremennik Trials.
  "dks-rex": { quests: ["The Fremennik Trials"] },
  "dks-prime": { quests: ["The Fremennik Trials"] },
  "dks-supreme": { quests: ["The Fremennik Trials"] },

  // The four Desert Treasure II bosses become repeatable after the quest.
  "vardorvis": { quests: ["Desert Treasure II - The Fallen Empire"] },
  "leviathan": { quests: ["Desert Treasure II - The Fallen Empire"] },
  "whisperer": { quests: ["Desert Treasure II - The Fallen Empire"] },
  "duke-sucellus": { quests: ["Desert Treasure II - The Fallen Empire"] }

  // Deliberately ungated: Obor, Bryophyta, Giant Mole, KBD, Sarachnis,
  // Skotizo, Araxxor and the Slayer-only bosses (Kraken, Cerberus, Hydra,
  // Sire, Thermonuclear, Grotesque Guardians) — those are level gates, which
  // the existing BOSS_GEAR_GATES already handles.
};

/** Keyed by the minigame slug in next-up-minigames.ts. */
export const MINIGAME_ACCESS: Record<string, AccessRequirement> = {
  // Guardians of the Rift opens with Temple of the Eye.
  "gotr": { quests: ["Temple of the Eye"] },
  // Pyramid Plunder needs Icthlarin's Little Helper.
  "pyramid-plunder": { quests: ["Icthlarin's Little Helper"] },
  // Both sit on Fossil Island / in Darkmeyer.
  "volcanic-mine": { quests: ["Bone Voyage"] },
  "hallowed-sepulchre": { quests: ["Sins of the Father"] }

  // Deliberately ungated: Wintertodt, Tempoross, Mahogany Homes, Motherlode
  // Mine, Soul Wars and Barbarian Assault are level gates only.
};

/** Every quest name used as a gate — tests check these exist in the quest DB. */
export function allGateQuestNames(): string[] {
  const names = new Set<string>();
  for (const requirement of [
    ...Object.values(MONEY_ACCESS),
    ...Object.values(BOSS_ACCESS),
    ...Object.values(MINIGAME_ACCESS)
  ]) {
    for (const quest of requirement.quests ?? []) names.add(quest);
  }
  return [...names].sort();
}
