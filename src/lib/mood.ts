// Mood-driven re-ranking laag boven computeNextUp().
//
// Filosofie: de bestaande recommendation-engine kent al alle gaps die
// een speler kan adresseren. Wat hij niet kan: "wat past bij jouw mood
// vanavond." Dat doen we hier — we boosten of penalizen scores op
// basis van mood + tijdbudget, dan kiezen we de 1 beste + 2 alts.
//
// Vier moods (later uitbreidbaar):
//   chill     — AFK, weinig denkwerk, lange sessies oke
//   focused   — XP/u optimaliseren, intensive methodes welkom
//   cash      — netto GP/u maximaliseren
//   quest     — questing progress (capes/lores/diary-eisen)
//
// Tijdbudget: 15 / 30 / 60 / 120 minuten. Beïnvloedt of we lange-zware
// dingen (Inferno) of korte-makkelijke dingen (clue scroll) aanraden.

import type { Recommendation, RecKind } from "./next-up";

export type Mood = "chill" | "focused" | "cash" | "quest";

/** Hoeveel minuten heeft de speler te besteden. Gebruikt om bv. een
 *  3u boss-grind af te wijzen voor een 15min sessie. */
export type TimeBudget = 15 | 30 | 60 | 120;

/** Per-mood boosts/penalties per RecKind. Waardes zijn vermenigvuldigers
 *  bovenop de base score. 1.0 = ongewijzigd, 1.5 = +50%, 0.4 = -60%. */
const MOOD_KIND_WEIGHTS: Record<Mood, Partial<Record<RecKind, number>>> = {
  chill: {
    skill:    1.6,  // AFK-able skills (Wintertodt, fishing, RC)
    bank:     1.3,  // bank-hygiene is lekker mindless
    minigame: 1.2,  // Tempoross etc.
    boss:     0.4,  // PvM is anti-chill
    kc:       0.5,
    quest:    0.6,
  },
  focused: {
    boss:     1.5,
    kc:       1.4,  // KC-drop chasing = focused activity
    skill:    1.2,  // PvM-skills lift
    minigame: 1.0,
    quest:    0.8,
    bank:     0.4,
  },
  cash: {
    money:    2.0,  // direct: money-recommendations winnen altijd
    boss:     1.4,  // PvM = vaak grote drops
    kc:       1.3,
    skill:    0.7,  // skill-grinding niet primary cash route
    quest:    0.5,
    bank:     0.6,
  },
  quest: {
    quest:    2.0,
    diary:    1.5,  // diaries vaak quest-locked
    goal:     1.3,  // bv. quest cape goal
    milestone:1.3,
    skill:    0.8,
    boss:     0.6,
    kc:       0.5,
    bank:     0.5,
  }
};

/** Tijd-budget filters. Sommige recs hebben een "ideale sessie-lengte"
 *  die we inferereren uit hun kind. Quick = clue/bank/skill-bump.
 *  Long = boss/raid/diary-clusters. Wanneer mismatch → penalty. */
function timeBudgetFit(rec: Recommendation, minutes: TimeBudget): number {
  switch (rec.kind) {
    case "bank":      return minutes <= 30 ? 1.4 : 1.0;
    case "skill":     return minutes >= 60 ? 1.3 : 0.9;
    case "boss":      return minutes >= 60 ? 1.2 : 0.6;
    case "kc":        return minutes >= 60 ? 1.2 : 0.7;
    case "quest":     return minutes >= 60 ? 1.2 : 0.7;
    case "diary":     return minutes >= 30 ? 1.1 : 0.8;
    case "minigame":  return minutes >= 30 ? 1.2 : 0.8;
    case "money":     return 1.0;
    default:          return 1.0;
  }
}

export interface MoodPick {
  /** De hoofdsuggestie — top na re-scoring. */
  headline: Recommendation;
  /** 2 alternatieven — ook hoog gerankt, maar van een andere kind
   *  dan headline (zodat de gebruiker écht alternatieven ziet, niet
   *  drie skill-recs op een rij). */
  alternatives: Recommendation[];
  /** Voor transparantie: wat was de mood + tijd waarop dit getuned is. */
  mood: Mood;
  minutes: TimeBudget;
}

/** Hoofdfunctie: ranked recs in, mood + tijd erbij, één hoofdpick +
 *  twee alternatieven uit. Wanneer er minder dan 3 recs zijn, vult
 *  alternatives met wat er overblijft. */
export function pickForMood(
  recs: Recommendation[],
  mood: Mood,
  minutes: TimeBudget
): MoodPick | null {
  if (recs.length === 0) return null;
  const weights = MOOD_KIND_WEIGHTS[mood];

  const scored = recs.map((rec) => {
    const kindMult = weights[rec.kind] ?? 1.0;
    const timeMult = timeBudgetFit(rec, minutes);
    return { rec, adjScore: rec.score * kindMult * timeMult };
  });
  scored.sort((a, b) => b.adjScore - a.adjScore);

  const headline = scored[0].rec;
  // Alternatives: pak de volgende twee die een andere `kind` hebben
  // dan headline. Geeft de speler diversity. Fallback naar volgende
  // beste twee als niet genoeg diversiteit.
  const seenKinds = new Set<RecKind>([headline.kind]);
  const alts: Recommendation[] = [];
  for (const s of scored.slice(1)) {
    if (alts.length === 2) break;
    if (!seenKinds.has(s.rec.kind)) {
      alts.push(s.rec);
      seenKinds.add(s.rec.kind);
    }
  }
  // Als we minder dan 2 hebben, vul aan met wat-dan-ook (mag dezelfde kind zijn)
  for (const s of scored.slice(1)) {
    if (alts.length === 2) break;
    if (!alts.includes(s.rec)) alts.push(s.rec);
  }

  return { headline, alternatives: alts, mood, minutes };
}

/** Beleefde mood-labels voor de UI. */
export const MOOD_LABEL: Record<Mood, { emoji: string; name: string; tagline: string }> = {
  chill:   { emoji: "🌙", name: "Chill",    tagline: "AFK, weinig denkwerk" },
  focused: { emoji: "🎯", name: "Focused",  tagline: "XP/u optimaliseren" },
  cash:    { emoji: "💰", name: "Cash",     tagline: "GP/u maximaliseren" },
  quest:   { emoji: "📜", name: "Quest",    tagline: "Story + unlocks" }
};
