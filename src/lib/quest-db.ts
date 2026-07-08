// Loads data/quests.json — the Wiki-derived quest dataset built by
// scripts/build-quest-data.mjs. Server-side only (reads from disk); the
// /next hub uses it through the recommendation engine.
//
// The dataset shape is documented in scripts/build-quest-data.mjs. Each
// record carries skill requirements (deduped to highest level per skill),
// the QP requirement, and the full prerequisite quest list.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface QuestSkillReq {
  skill: string;
  level: number;
}

export interface QuestItemAlternative {
  name: string;
  quantity: number;
  note?: string;
}

export interface QuestItemReq {
  id: string;
  name: string;
  quantity: number;
  note?: string;
  alternatives: QuestItemAlternative[];
}

export interface QuestRecord {
  name: string;
  difficulty: string | null;        // Novice / Intermediate / Experienced / Master / Grandmaster / Special
  length: string | null;            // Very Short / Short / Medium / Long / Very Long
  qpReq: number;                    // 0 = no QP gate
  skillReqs: QuestSkillReq[];
  questReqs: string[];              // full prerequisite chain (Wiki-derived)
  itemReqs: QuestItemReq[];
  ironmanNotes: string[];
}

let cache: Map<string, QuestRecord> | null = null;
let loading: Promise<Map<string, QuestRecord>> | null = null;

async function load(): Promise<Map<string, QuestRecord>> {
  const path = join(process.cwd(), "data", "quests.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Record<string, Partial<QuestRecord> & { name: string }>;
  const m = new Map<string, QuestRecord>();
  for (const [k, v] of Object.entries(parsed)) {
    m.set(k, {
      name: v.name,
      difficulty: v.difficulty ?? null,
      length: v.length ?? null,
      qpReq: v.qpReq ?? 0,
      skillReqs: Array.isArray(v.skillReqs) ? v.skillReqs : [],
      questReqs: Array.isArray(v.questReqs) ? v.questReqs : [],
      itemReqs: Array.isArray(v.itemReqs) ? v.itemReqs : [],
      ironmanNotes: Array.isArray(v.ironmanNotes) ? v.ironmanNotes : []
    });
  }
  return m;
}

export async function getQuests(): Promise<Map<string, QuestRecord>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = load().then((m) => {
    cache = m;
    loading = null;
    return m;
  });
  return loading;
}

export function questSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getQuestBySlug(slug: string): Promise<QuestRecord | null> {
  const quests = await getQuests();
  const clean = slug.trim().toLowerCase();
  for (const quest of quests.values()) {
    if (questSlug(quest.name) === clean) return quest;
  }
  return null;
}
