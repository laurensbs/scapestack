// Loads data/drop-rates.json — per-boss rare-drop tables pulled from the
// OSRS Wiki by scripts/build-drop-rates.mjs. The /next engine uses it to
// convert a player's Hiscores boss-KC into an expected-uniques readout
// ("142 Vorkath KC ≈ 0.85 visages expected, 0.05 Vorki pet chance").
//
// Server-side only — keeps the JSON off the client bundle.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DropEntry {
  name: string;
  num: number;       // numerator of the rarity fraction
  denom: number;     // denominator
  rarity: string;    // "1/5000", "2/150" — original Wiki form, for display
}

export interface BossDropTable {
  hiscoresName: string;     // matches the OSRS Hiscores activity name
  drops: DropEntry[];       // sorted rarest first
}

let cache: Map<string, BossDropTable> | null = null;
let loading: Promise<Map<string, BossDropTable>> | null = null;

async function load(): Promise<Map<string, BossDropTable>> {
  const path = join(process.cwd(), "data", "drop-rates.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Record<string, BossDropTable>;
  const m = new Map<string, BossDropTable>();
  for (const [k, v] of Object.entries(parsed)) m.set(k, v);
  return m;
}

export async function getDropRates(): Promise<Map<string, BossDropTable>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = load().then((m) => {
    cache = m;
    loading = null;
    return m;
  });
  return loading;
}
