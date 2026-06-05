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
    slayer:   1.1,  // huidige task afmaken kan prima semi-AFK
    boss:     0.4,  // PvM is anti-chill
    kc:       0.5,
    quest:    0.6,
  },
  focused: {
    boss:     1.5,
    kc:       1.4,  // KC-drop chasing = focused activity
    slayer:   1.4,  // live task afmaken = duidelijke focused sessie
    skill:    1.2,  // PvM-skills lift
    minigame: 1.0,
    quest:    0.8,
    bank:     0.4,
  },
  cash: {
    money:    2.0,  // direct: money-recommendations winnen altijd
    boss:     1.4,  // PvM = vaak grote drops
    kc:       1.3,
    slayer:   0.9,  // kan geld opleveren, maar niet primair GP/u
    skill:    0.7,  // skill-grinding niet primary cash route
    quest:    0.5,
    bank:     0.6,
  },
  quest: {
    quest:    2.0,
    diary:    1.5,  // diaries vaak quest-locked
    goal:     1.3,  // bv. quest cape goal
    milestone:1.3,
    slayer:   0.7,
    skill:    0.8,
    boss:     0.6,
    kc:       0.5,
    bank:     0.5,
  }
};

/** Tijd-budget filter — schaarser dan voorheen. Elke kind heeft een
 *  realistische min/max sessie-tijd; als de gekozen budget buiten die
 *  range valt, krijgt de rec een serieuze penalty (down to 0.15).
 *
 *  Filosofie: liever 5 goede recs voor 15 min dan 5 abstracte. Een
 *  Inferno-rec bij 15min budget is gewoon niet relevant.
 *
 *  Daily-style money recs hebben de smalste range (5-15 min) zodat ze
 *  niet je 2u sessie volpompen.
 */
function timeBudgetFit(rec: Recommendation, minutes: TimeBudget): number {
  // [minViable, sweetSpot, maxComfortable] per kind. Buiten min/max =
  // harde penalty (0.15-0.4). In de range = soft curve naar 1.4 piek.
  const ranges: Record<RecKind | "default", [number, number, number]> = {
    bank:      [5,  20, 30],   // klusje, niet voor lange sessie
    minigame:  [10, 30, 60],   // round-based
    diary:     [15, 45, 90],   // tier voltooien
    money:     [10, 30, 60],   // herb runs, daily, GP-pulses
    skill:     [30, 90, 180],  // grinding works at any length above 30
    slayer:    [10, 45, 120],  // current-task remainder via plugin
    boss:      [45, 90, 180],  // trip incl. travel + bank
    kc:        [45, 90, 180],  // drop chase = lange sessie
    quest:     [30, 90, 180],  // te kort = onaf, te lang = burnout
    goal:      [15, 60, 180],  // breed: zowel een quest cape als skill cape
    milestone: [15, 60, 180],
    default:   [15, 60, 120],
  };
  const [low, spot, high] = ranges[rec.kind] ?? ranges.default;
  // Out-of-range: harde penalty (15min sessie + 2u boss = 0.15).
  if (minutes < low) {
    const ratio = minutes / low;
    return Math.max(0.15, 0.5 * ratio);
  }
  if (minutes > high) {
    const ratio = high / minutes;
    return Math.max(0.25, 0.7 * ratio);
  }
  // In range — driehoek-curve met piek op sweet spot, floor 0.85.
  const distToSpot = Math.abs(minutes - spot);
  const halfRange = Math.max(spot - low, high - spot);
  const proximity = 1 - distToSpot / halfRange;
  return 0.85 + 0.55 * proximity; // 0.85 .. 1.4
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
 *  alternatives met wat er overblijft.
 *
 *  shuffleIndex: 0 = absolute top; 1 = "geef me wat anders" (skip
 *  het #1 picked, pak #2). Diversity-rule: shuffle moet ook een
 *  ander kind opleveren tov de huidige headline — niet "boss
 *  vorkath" → "boss kbd". */
export function pickForMood(
  recs: Recommendation[],
  mood: Mood,
  minutes: TimeBudget,
  shuffleIndex: number = 0
): MoodPick | null {
  if (recs.length === 0) return null;
  const weights = MOOD_KIND_WEIGHTS[mood];

  const scored = recs.map((rec) => {
    const kindMult = weights[rec.kind] ?? 1.0;
    const timeMult = timeBudgetFit(rec, minutes);
    return { rec, adjScore: rec.score * kindMult * timeMult };
  });
  scored.sort((a, b) => b.adjScore - a.adjScore);

  // Shuffle: bouw een lijst van "hero-kandidaten" waar elke
  // opeenvolgende een ander kind heeft dan z'n voorganger. Dat
  // voorkomt "boss → boss → boss" als de speler op de shuffle-knop
  // ramt.
  const heroCandidates: Recommendation[] = [];
  const usedKinds = new Set<RecKind>();
  for (const s of scored) {
    if (!usedKinds.has(s.rec.kind)) {
      heroCandidates.push(s.rec);
      usedKinds.add(s.rec.kind);
    }
  }
  // Als de speler verder shuffled dan we kinds hebben → cycle terug
  // door alle scored recs (zelfde kind mag dan terugkomen).
  const fallbackList = scored.map((s) => s.rec);
  const headline =
    heroCandidates[shuffleIndex % Math.max(1, heroCandidates.length)]
    ?? fallbackList[shuffleIndex % fallbackList.length]
    ?? scored[0].rec;

  // Alternatieven: pak de volgende twee uit heroCandidates die niet
  // headline zijn. Wanneer minder dan 2 over, val terug op fallback.
  const alts: Recommendation[] = [];
  const seenIds = new Set([headline.id]);
  for (const r of heroCandidates) {
    if (alts.length === 2) break;
    if (!seenIds.has(r.id)) {
      alts.push(r);
      seenIds.add(r.id);
    }
  }
  // Vul aan met wat-dan-ook (zelfde kind mag) als we minder dan 2 hebben.
  for (const r of fallbackList) {
    if (alts.length === 2) break;
    if (!seenIds.has(r.id)) {
      alts.push(r);
      seenIds.add(r.id);
    }
  }

  return { headline, alternatives: alts, mood, minutes };
}

/** Mood labels met OSRS item-icons. Items kiezen we zo dat ze de vibe
 *  in één blik communiceren — iconisch genoeg dat een gemiddelde speler
 *  ze direct herkent uit hun bank.
 *    chill   → Tinderbox     — Wintertodt is dé chill-skill (firemaking)
 *    focused → Abyssal whip  — de meest iconische combat-grind tool
 *    cash    → Coins-stack   — universally GP, geen twijfel mogelijk
 *    quest   → Quest point cape — questing signature
 *  Item-IDs gecheckt op OSRS Wiki sprite-CDN. */
export const MOOD_LABEL: Record<Mood, { itemId: number; name: string; tagline: string }> = {
  chill:   { itemId: 6739,  name: "Chill",   tagline: "AFK, low effort" },     // Dragon axe
  focused: { itemId: 21295, name: "Focused", tagline: "Optimise XP/hour" },    // Infernal cape
  cash:    { itemId: 22006, name: "Cash",    tagline: "Maximise GP/hour" },    // Vorkath's head
  quest:   { itemId: 9813,  name: "Quest",   tagline: "Story + unlocks" }      // Quest point cape
};
