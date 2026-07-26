import { describe, expect, it } from "vitest";
import { assemblePlanningPayload } from "@/lib/planning-context";
import { evaluateQuestRequirements } from "@/lib/quest-requirements";
import { buildQuestRoute } from "@/lib/quest-route";
import { getQuestBySlug, getQuests } from "@/lib/quest-db";
import type { SyncedPlayer } from "@/lib/sync-repo";

/**
 * The bank does not reach a stranger — checked against the payload, not the source.
 *
 * Two guards already existed for this and both passed while the bank was
 * leaking, because both read the page files as text:
 *
 *   tests/synced-player-visibility.test.ts matched `syncedPlayerForViewer(scapestack`
 *   in planning-context.ts and never looked at `initialPlan`, which was derived
 *   from the same bank and shipped next to it.
 *
 *   tests/plugin-contract-v4.test.ts asserted the quest page contains
 *   `bankItems: serverBankItems` — pinning the leaking call in place and calling
 *   it a regression test.
 *
 * So this one builds the object that actually crosses to the browser and
 * searches every string and number in it. If a future refactor reintroduces a
 * bank-derived field, it fails here regardless of how the code is spelled.
 */

/** Deliberately distinctive so a hit cannot be a coincidence. */
const SECRET_BANK = [
  { id: 20997, name: "Twisted bow", quantity: 1 },
  { id: 11832, name: "Bandos chestplate", quantity: 1 },
  { id: 1515, name: "Yew logs", quantity: 5000 },
  { id: 995, name: "Coins", quantity: 123456789 },
  { id: 11212, name: "Dragon arrow", quantity: 4242 }
];

/**
 * Names are matched as substrings because generated copy embeds them in
 * sentences ("Scapestack found twisted bow in your bank"). Ids and quantities
 * are matched exactly: a substring search for a quantity of 1 matches every
 * number on the page, which is how the first run of this test reported
 * sixteen leaks that were all the digit 1. Quantity 1 is dropped entirely —
 * it carries no information about anyone.
 */
/**
 * "Coins" is deliberately not a name needle. It is an ordinary word in public
 * quest and diary text — "can be bought from Thessalia for 30 coins" — so
 * matching it reports the wiki's own copy as a leak. The coin BALANCE is still
 * guarded, as an exact quantity below, and that is the private fact.
 */
const GENERIC_WORDS = new Set(["Coins"]);
const NAME_NEEDLES = SECRET_BANK
  .map((item) => item.name)
  .filter((name) => !GENERIC_WORDS.has(name));
const EXACT_NEEDLES = [
  ...SECRET_BANK.map((item) => String(item.id)),
  ...SECRET_BANK.filter((item) => item.quantity > 1).map((item) => String(item.quantity)),
  "123,456,789"
];

/** Every string and number anywhere in the object, flattened. */
function scalars(value: unknown, out: string[] = []): string[] {
  if (value === null || value === undefined) return out;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) scalars(entry, out);
    return out;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) scalars(entry, out);
  }
  return out;
}

function leaks(payload: unknown): string[] {
  const haystack = scalars(payload);
  const lower = haystack.map((straw) => straw.toLowerCase());
  return [
    ...NAME_NEEDLES.filter((needle) => lower.some((straw) => straw.includes(needle.toLowerCase()))),
    ...EXACT_NEEDLES.filter((needle) => haystack.includes(needle))
  ];
}

const PLAYER: SyncedPlayer = {
  rsn: "leaktest",
  displayName: "Leaktest",
  accountType: "normal",
  bankItems: SECRET_BANK,
  // A real PluginBankStatus object, not the string "available". The first
  // version of this fixture used a string, `shouldUsePluginBank` returned
  // false, the bank never entered the planner input, and all three tests
  // passed against a plan that could not have leaked anything. The fixture
  // was the vacuum, not the assertion.
  bankStatus: {
    enabled: true,
    itemCount: SECRET_BANK.length,
    // Fresh: shouldUsePluginBank drops a snapshot older than 24h, and an
    // epoch timestamp made the bank stale and the guard toothless.
    capturedAt: new Date().toISOString(),
    unavailableReason: null
  },
  collectionLogItemIds: [20997, 11832],
  skills: [
    { name: "Attack", level: 90, xp: 5346332 },
    { name: "Strength", level: 90, xp: 5346332 },
    { name: "Defence", level: 80, xp: 1986068 },
    { name: "Hitpoints", level: 85, xp: 3258594 },
    { name: "Ranged", level: 92, xp: 6517253 },
    { name: "Magic", level: 85, xp: 3258594 },
    { name: "Prayer", level: 74, xp: 1096278 },
    { name: "Slayer", level: 80, xp: 1986068 }
  ],
  slayer: null,
  questsCompleted: [],
  diariesCompleted: [],
  bossKc: {},
  equipment: null,
  farming: null,
  combatAchievements: null,
  availability: undefined,
  pluginVersion: "0.3.0",
  syncedAt: new Date().toISOString()
} as unknown as SyncedPlayer;

const TIMING = {
  totalMs: 0, criticalMs: 0, optionalMs: 0, plannerMs: 0, timeoutCount: 0, sources: []
};

describe("/next?rsn= does not ship the account's bank to a stranger", () => {
  it("keeps every bank item out of the payload when nobody is signed in", async () => {
    const payload = await assemblePlanningPayload({
      rsn: "leaktest",
      hiscores: null,
      wom: null,
      collectionLog: null,
      scapestack: PLAYER,
      viewerRsn: null,
      timing: TIMING
    });
    expect(leaks(payload), "leaked into the RSC payload").toEqual([]);
  });

  it("keeps it out for a signed-in viewer who is somebody else", async () => {
    const payload = await assemblePlanningPayload({
      rsn: "leaktest",
      hiscores: null,
      wom: null,
      collectionLog: null,
      scapestack: PLAYER,
      viewerRsn: "someone-else",
      timing: TIMING
    });
    expect(leaks(payload)).toEqual([]);
  });

  it("still gives the owner their own bank, so the guard is not passing by emptiness", async () => {
    const payload = await assemblePlanningPayload({
      rsn: "leaktest",
      hiscores: null,
      wom: null,
      collectionLog: null,
      scapestack: PLAYER,
      viewerRsn: "leaktest",
      timing: TIMING
    });
    expect(payload.scapestackSync?.bankItems).toHaveLength(SECRET_BANK.length);
    // The load-bearing assertion. `scapestackSync` alone would satisfy a plain
    // leaks() check, so this looks at the PLAN specifically: the owner's plan
    // must be bank-aware, which proves the two tests above are watching a path
    // that carries bank data and can therefore fail.
    expect(leaks(payload.initialPlan).length).toBeGreaterThan(0);
  });
});

describe("/quests/[slug]?rsn= does not ship the account's bank to a stranger", () => {
  // The exact quests the audit found leaking a coin balance.
  const SLUGS = ["dragon-slayer-i", "demon-slayer", "the-feud", "tree-gnome-village"];

  it("keeps bank names and quantities out of the route and the evaluation", async () => {
    const quests = await getQuests();
    const found: string[] = [];
    for (const slug of SLUGS) {
      const quest = await getQuestBySlug(slug);
      if (!quest) continue;
      // A non-owner: exactly what the page now passes.
      const bankItems: typeof SECRET_BANK = [];
      const route = buildQuestRoute(quest, quests, { skills: [], bankItems, accountType: null, payoff: "" });
      const evaluation = evaluateQuestRequirements(quest, {
        skills: [], completedQuests: [], bankItems, accountType: null
      });
      found.push(...leaks(route.progress).map((hit) => `${slug} route: ${hit}`));
      found.push(...leaks(evaluation).map((hit) => `${slug} evaluation: ${hit}`));
    }
    expect(found).toEqual([]);
  });

  it("proves the same call leaks when the bank IS passed, so the check is real", async () => {
    // If this ever goes green the test above has stopped meaning anything —
    // it would mean these functions no longer carry bank data at all and the
    // guard is watching a path that cannot fail.
    const quests = await getQuests();
    const quest = await getQuestBySlug("dragon-slayer-i");
    expect(quest).toBeTruthy();
    const evaluation = evaluateQuestRequirements(quest!, {
      skills: [], completedQuests: [], bankItems: SECRET_BANK, accountType: null
    });
    expect(leaks(evaluation).length).toBeGreaterThan(0);
  });
});
