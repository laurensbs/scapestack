import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PVM_ITEMS } from "@/lib/pvm-items";

// Load the wiki items dump so we can verify each curated entry actually
// corresponds to a real item with the name the trailing comment claims.
function loadItems(): Map<number, string> {
  const path = join(process.cwd(), "data", "items.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string | { name?: string }>;
  const m = new Map<number, string>();
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const name = typeof v === "string" ? v : v?.name;
    if (name) m.set(id, name);
  }
  return m;
}

function loadCommentMap(): Map<number, string> {
  const src = readFileSync(join(process.cwd(), "src/lib/pvm-items.ts"), "utf8");
  const re = /^\s+(\d+):\s+\{[^}]+\},?\s+\/\/\s+(.+)$/gm;
  const m = new Map<number, string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const id = Number(match[1]);
    const comment = match[2].replace(/\s+—.*$/, "").trim();
    m.set(id, comment);
  }
  return m;
}

describe("pvm-items DB", () => {
  it("every entry references a real item ID", () => {
    const items = loadItems();
    const missing: number[] = [];
    for (const id of Object.keys(PVM_ITEMS).map(Number)) {
      if (!items.has(id)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  it("every entry's trailing comment matches the item name", () => {
    const items = loadItems();
    const comments = loadCommentMap();
    const mismatches: string[] = [];
    for (const [id, comment] of comments) {
      const actual = items.get(id);
      if (!actual) continue; // covered by the previous test
      const a = actual.toLowerCase().trim();
      const c = comment.toLowerCase().trim();
      // Accept either direction of containment to allow annotations.
      if (a !== c && !a.startsWith(c) && !c.startsWith(a)) {
        mismatches.push(`${id} = "${actual}" but DB comment says "${comment}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("has at least 250 entries", () => {
    expect(Object.keys(PVM_ITEMS).length).toBeGreaterThanOrEqual(250);
  });

  it("covers all combat styles", () => {
    const styles = new Set(Object.values(PVM_ITEMS).map((e) => e.style));
    expect(styles).toContain("melee");
    expect(styles).toContain("ranged");
    expect(styles).toContain("magic");
    expect(styles).toContain("neutral");
  });

  it("covers all equipment slots used by PvM gear", () => {
    const slots = new Set(Object.values(PVM_ITEMS).map((e) => e.slot));
    for (const required of ["head", "cape", "neck", "ammo", "weapon", "shield", "body", "legs", "hands", "feet", "ring"]) {
      expect(slots).toContain(required as never);
    }
  });
});
