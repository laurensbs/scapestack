// Consistency-tests voor de Slayer data files.
//
// Doel: catch the dumb mistakes voordat ze in productie landen.
// Geen game-logic — alleen "is dit data goed gevormd."
//   - Geen duplicate IDs in MONSTERS of UNLOCKS
//   - Elke MasterId in MASTERS heeft een POOLS entry
//   - POOLS verwijzen naar bestaande monsters (warning, geen error —
//     pools mogen nog ontbrekende monsters bevatten als TODO)
//   - eligibleMasters() respecteert combat/slayer/quest gates
//   - recommendedOrder() unlocks zijn in oplopende volgorde
//   - Geen monster heeft slayerLevel > 99 (game cap)
//
// Refresh-test wanneer iemand een monster toevoegt: voer het opnieuw
// uit. Falende tests komen meestal door typos in id-references.

import { describe, it, expect } from "vitest";
import { MASTERS, MASTER_ORDER, eligibleMasters } from "@/lib/slayer/masters";
import { MONSTERS, MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { POOLS } from "@/lib/slayer/task-pools";
import { UNLOCKS, UNLOCKS_BY_ID, recommendedOrder } from "@/lib/slayer/unlocks";

describe("MASTERS", () => {
  it("MASTER_ORDER bevat alle masters precies eenmaal", () => {
    const ids = Object.keys(MASTERS).sort();
    const ordered = [...MASTER_ORDER].sort();
    expect(ordered).toEqual(ids);
    expect(new Set(MASTER_ORDER).size).toBe(MASTER_ORDER.length);
  });

  it("elke master heeft een valide task-quantity range", () => {
    for (const m of Object.values(MASTERS)) {
      expect(m.taskQuantity.min).toBeGreaterThan(0);
      expect(m.taskQuantity.max).toBeGreaterThanOrEqual(m.taskQuantity.min);
    }
  });

  it("streak-bonus multipliers zijn oplopend", () => {
    for (const m of Object.values(MASTERS)) {
      const s = m.streakBonus;
      expect(s.every10).toBeLessThanOrEqual(s.every50);
      expect(s.every50).toBeLessThanOrEqual(s.every100);
      expect(s.every100).toBeLessThanOrEqual(s.every250);
      expect(s.every250).toBeLessThanOrEqual(s.every1000);
    }
  });

  it("eligibleMasters filtert op combat/slayer/quest", () => {
    // Beginner: 3 combat, 1 slayer, geen quests → alleen Turael
    const beginner = eligibleMasters({
      combatLevel: 3, slayerLevel: 1, completedQuests: new Set()
    });
    expect(beginner.map((m) => m.id)).toEqual(["turael"]);

    // Maxer: 126 combat, 99 slayer, alle quests → alle masters
    const maxer = eligibleMasters({
      combatLevel: 126,
      slayerLevel: 99,
      completedQuests: new Set(["priest_in_peril", "lost_city", "shilo_village"])
    });
    expect(maxer.map((m) => m.id)).toEqual(MASTER_ORDER);

    // Mid: 75 combat 75 slayer geen Shilo Village → Konar wel, Duradel niet
    const mid = eligibleMasters({
      combatLevel: 75, slayerLevel: 75,
      completedQuests: new Set(["priest_in_peril", "lost_city"])
    });
    expect(mid.map((m) => m.id)).toContain("konar");
    expect(mid.map((m) => m.id)).not.toContain("duradel");
  });
});

describe("MONSTERS", () => {
  it("geen duplicate IDs", () => {
    const ids = MONSTERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("MONSTERS_BY_ID dekt alle entries", () => {
    expect(MONSTERS_BY_ID.size).toBe(MONSTERS.length);
  });

  it("elke monster heeft sane velden", () => {
    for (const m of MONSTERS) {
      expect(m.id).toMatch(/^[a-z0-9_]+$/);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.hp).toBeGreaterThan(0);
      expect(m.slayerLevel).toBeGreaterThanOrEqual(1);
      expect(m.slayerLevel).toBeLessThanOrEqual(99);
      expect(m.locations.length).toBeGreaterThan(0);
    }
  });
});

describe("POOLS", () => {
  it("elke MasterId heeft een pool", () => {
    for (const id of MASTER_ORDER) {
      expect(POOLS[id]).toBeDefined();
      expect(Object.keys(POOLS[id]).length).toBeGreaterThan(0);
    }
  });

  it("alle weights zijn positief", () => {
    for (const [masterId, pool] of Object.entries(POOLS)) {
      for (const [monsterId, weight] of Object.entries(pool)) {
        expect(weight, `${masterId}.${monsterId}`).toBeGreaterThan(0);
      }
    }
  });

  it("pools verwijzen vooral naar bestaande monsters (warning op stragglers)", () => {
    // Hard fail wanneer >20% van de pool-entries onbekende monsters zijn.
    // We tolereren een paar (data-TODO bv. iron_dragon, dwarf, hobgoblin
    // staan in pools maar nog niet in monsters.ts).
    let total = 0;
    let missing = 0;
    for (const pool of Object.values(POOLS)) {
      for (const monsterId of Object.keys(pool)) {
        total++;
        if (!MONSTERS_BY_ID.has(monsterId)) missing++;
      }
    }
    expect(missing / total, `${missing}/${total} pool-entries onbekend`).toBeLessThan(0.20);
  });

  it("Konar's pool overlapt vrijwel volledig met Konar-eligible monsters", () => {
    // Heuristisch: Konar geeft alleen slayer 1+ tasks die kill-location
    // gating ondersteunen. Geen low-level Turael tasks zoals 'bird'.
    expect(POOLS.konar).not.toHaveProperty("bird");
    expect(POOLS.konar).not.toHaveProperty("dog");
  });

  it("Duradel's pool bevat alle high-slayer monsters", () => {
    // Sanity: Abyssal demon (lvl 85) MOET in Duradel's pool zitten.
    expect(POOLS.duradel).toHaveProperty("abyssal_demon");
    // En Dark beast (lvl 90) ook.
    expect(POOLS.duradel).toHaveProperty("dark_beast");
  });
});

describe("UNLOCKS", () => {
  it("geen duplicate IDs", () => {
    const ids = UNLOCKS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("UNLOCKS_BY_ID dekt alle entries", () => {
    expect(UNLOCKS_BY_ID.size).toBe(UNLOCKS.length);
  });

  it("costs zijn positieve gehele getallen", () => {
    for (const u of UNLOCKS) {
      expect(u.cost).toBeGreaterThan(0);
      expect(Number.isInteger(u.cost)).toBe(true);
    }
  });

  it("recommendedOrder() sorteert oplopend, met onbekenden achteraan", () => {
    const order = recommendedOrder();
    let lastN = -1;
    for (const u of order) {
      const n = u.recommendedOrder ?? 1000;
      expect(n).toBeGreaterThanOrEqual(lastN);
      lastN = n;
    }
  });

  it("categorieën zijn van het verwachte set", () => {
    const allowed = new Set(["unlock", "block", "extend", "ability"]);
    for (const u of UNLOCKS) {
      expect(allowed.has(u.category)).toBe(true);
    }
  });
});
