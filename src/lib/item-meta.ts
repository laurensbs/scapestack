// Loads data/item-meta.json — the Wiki-derived per-item fact layer that lets
// the classifier decide on equipment slot / combat style / skill instead of
// guessing from the name. Built by scripts/build-item-data.mjs.
//
// Server-side only (reads from disk). The organize action runs on the server,
// so this never ships to the client bundle.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// One record per item id. Any field may be null when the Wiki had no data
// for that item — callers must treat the whole layer as best-effort.
export interface ItemMeta {
  slot: string | null;        // head, cape, neck, ammo, weapon, body, shield, legs, hands, feet, ring
  style: string | null;       // melee, ranged, magic
  skills: string[];           // herblore, farming, mining, …
  kinds: string[];            // armour, weapon, potion, food, rune, log, ore, bar, gem, seed, tool, pet, clue, twohand
  clue: string | null;        // easy, medium, hard, elite, master
  value: number | null;       // GE store value
  highalch: number | null;
  members: boolean | null;
  tradeable: boolean;         // present in the GE price mapping
  examine: string | null;
}

let cache: Map<number, ItemMeta> | null = null;
let loading: Promise<Map<number, ItemMeta>> | null = null;

async function load(): Promise<Map<number, ItemMeta>> {
  const path = join(process.cwd(), "data", "item-meta.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Record<string, ItemMeta>;
  const m = new Map<number, ItemMeta>();
  for (const [k, v] of Object.entries(parsed)) {
    const id = Number(k);
    if (Number.isFinite(id)) m.set(id, v);
  }
  return m;
}

export async function getItemMeta(): Promise<Map<number, ItemMeta>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = load().then((m) => {
    cache = m;
    loading = null;
    return m;
  });
  return loading;
}
