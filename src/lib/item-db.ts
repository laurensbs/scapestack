// Loads data/items.json once into memory.
// File shape: { "<id>": { id, name, ... } } — we project to Map<id, name>.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let items: Map<number, string> | null = null;
let loading: Promise<Map<number, string>> | null = null;

interface ItemRow { id?: number; name?: string }

async function load(): Promise<Map<number, string>> {
  const path = join(process.cwd(), "data", "items.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Record<string, ItemRow | string>;
  const m = new Map<number, string>();
  for (const [k, v] of Object.entries(parsed)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    let name: string | undefined;
    if (typeof v === "string") name = v;
    else if (v && typeof v === "object") name = v.name;
    if (name && typeof name === "string" && name.trim()) m.set(id, name);
  }
  return m;
}

export async function getItems(): Promise<Map<number, string>> {
  if (items) return items;
  if (loading) return loading;
  loading = load().then((m) => {
    items = m;
    loading = null;
    return m;
  });
  return loading;
}

export async function getName(id: number): Promise<string | undefined> {
  const m = await getItems();
  const direct = m.get(Math.abs(id));
  if (direct) return id < 0 ? `${direct} (variant)` : direct;
  return undefined;
}
