// Loads data/diaries.json — the Wiki-derived diary dataset built by
// scripts/build-diary-data.mjs. Server-side only; the /next hub uses it
// through the recommendation engine.
//
// Shape lives in scripts/build-diary-data.mjs. Each diary region carries a
// `tiers` map with Easy/Medium/Hard/Elite skill requirements.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type DiaryTier = "Easy" | "Medium" | "Hard" | "Elite";

export interface DiarySkillReq {
  skill: string;
  level: number;
}

export interface DiaryTierData {
  skills: DiarySkillReq[];
}

export interface DiaryRecord {
  name: string;                      // "Karamja Diary"
  tiers: Record<DiaryTier, DiaryTierData>;
}

let cache: Map<string, DiaryRecord> | null = null;
let loading: Promise<Map<string, DiaryRecord>> | null = null;

async function load(): Promise<Map<string, DiaryRecord>> {
  const path = join(process.cwd(), "data", "diaries.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Record<string, DiaryRecord>;
  const m = new Map<string, DiaryRecord>();
  for (const [k, v] of Object.entries(parsed)) m.set(k, v);
  return m;
}

export async function getDiaries(): Promise<Map<string, DiaryRecord>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = load().then((m) => {
    cache = m;
    loading = null;
    return m;
  });
  return loading;
}
