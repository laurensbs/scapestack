import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GEAR, lookupGear } from "@/lib/gear";

/**
 * The gear table is keyed by item id, and an id is a fact about the game.
 *
 * Two entries carried the wrong one. `Voidwaker` was 28688, which is the
 * Blazing blowpipe — so a bank holding a blowpipe resolved to a stab weapon
 * with a melee strength bonus, and every DPS number computed from it was
 * about a different weapon. `Ardougne cloak 4` was 13073, which is the Elite
 * void robe: the cloak was invisible to `ownedGear` and the robe counted
 * twice.
 *
 * Neither could be caught by reading gear.ts. Both fall out immediately from
 * comparing it against the item dataset the rest of the site already ships.
 */

interface ItemRow { id: number; name: string }

function itemsById(): Map<number, string[]> {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data/items.json"), "utf8")) as unknown;
  const rows: ItemRow[] = Array.isArray(raw)
    ? (raw as ItemRow[])
    : Object.entries(raw as Record<string, string>).map(([id, name]) => ({ id: Number(id), name }));
  const byId = new Map<number, string[]>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id)!.push(String(row.name));
  }
  return byId;
}

describe("the gear table names real items", () => {
  it("has no id twice", () => {
    // lookupGear returns the FIRST match, so a duplicate silently decides
    // which of two items the whole engine believes you are holding.
    const seen = new Map<number, string>();
    const clashes: string[] = [];
    for (const item of GEAR) {
      const previous = seen.get(item.id);
      if (previous) clashes.push(`${item.id}: ${previous} vs ${item.name}`);
      else seen.set(item.id, item.name);
    }
    expect(clashes, `duplicate item ids:\n${clashes.join("\n")}`).toEqual([]);
  });

  it("gives every entry the id the game gives it", () => {
    const byId = itemsById();
    // items.json is a snapshot. An item released after it was taken has an id
    // above everything in the file and cannot be checked against it — but an
    // id BELOW the ceiling that names something else is always a mistake, so
    // this stays a real check rather than a rubber stamp.
    const ceiling = Math.max(...byId.keys());
    const wrong: string[] = [];
    const unverifiable: string[] = [];
    for (const item of GEAR) {
      const names = byId.get(item.id);
      if (!names) {
        if (item.id > ceiling) unverifiable.push(`${item.name} (${item.id})`);
        else wrong.push(`${item.name}: id ${item.id} is not an item`);
        continue;
      }
      const match = names.some((name) => name.toLowerCase() === item.name.toLowerCase());
      if (!match) wrong.push(`${item.name}: id ${item.id} is "${names[0]}"`);
    }
    expect(wrong, `gear entries whose id belongs to a different item:\n${wrong.join("\n")}`).toEqual([]);
    // Named out loud. A silently growing list of unverifiable entries is how
    // this check would stop meaning anything.
    expect(
      unverifiable.length,
      `entries newer than data/items.json, so unverified: ${unverifiable.join(", ")}`
    ).toBeLessThanOrEqual(1);
  });

  it("holds for every id/name pair in production code, not just this table", () => {
    // The same corruption was in upgrades.ts (11 entries) and in the demo
    // account's bank, where "Magic fang" was id 12921 — Pet snakeling. An item
    // id is looked up for stats AND for the sprite, so a wrong one draws the
    // wrong picture next to the wrong advice.
    //
    // Skipped on purpose: id 0 (a sentinel, never an item) and dps-client's
    // short nicknames, where "Whip" for 4151 is a label for the real Abyssal
    // whip rather than a claim about which item that is.
    const byId = itemsById();
    const wrong: string[] = [];
    for (const file of ["src/lib/gear.ts", "src/lib/upgrades.ts", "src/lib/reference-account.ts", "src/lib/pvm-items.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of source.matchAll(/\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)"/g)) {
        const id = Number(match[1]);
        if (id === 0) continue;
        const names = byId.get(id);
        if (!names) continue;
        if (names.some((name) => name.toLowerCase() === match[2].toLowerCase())) continue;
        wrong.push(`${file}: ${id} labelled "${match[2]}" is really "${names[0]}"`);
      }
    }
    expect(wrong, `id/name pairs that disagree with data/items.json:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("resolves the two ids that were wrong", () => {
    // Named, because a regression here is silent: the lookup still returns
    // something, it is just the wrong weapon.
    expect(lookupGear(28688)?.name).toBe("Blazing blowpipe");
    expect(lookupGear(27690)?.name).toBe("Voidwaker");
    expect(lookupGear(13073)?.name).toBe("Elite void robe");
    expect(lookupGear(13124)?.name).toBe("Ardougne cloak 4");
  });
});
