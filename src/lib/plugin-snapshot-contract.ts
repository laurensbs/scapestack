// The version the published plugin speaks today. Release checks pin against
// this, so it only moves when a plugin actually ships the new contract.
export const PLUGIN_SNAPSHOT_CONTRACT_VERSION = 3 as const;

// The next contract, accepted by the server before any plugin sends it.
//
// This ordering is load-bearing. The plugin ships through the Plugin Hub as
// one immutable commit with no rollback; if a v4 plugin ever reached players
// before the server accepted v4, every synced account would break permanently.
// So the server learns the new version first, runs in production accepting
// both, and only then does a plugin exist that uses it.
export const PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4 = 4 as const;
export const PLUGIN_SNAPSHOT_ACCEPTED_CONTRACT_VERSIONS: ReadonlySet<number> = new Set([
  PLUGIN_SNAPSHOT_CONTRACT_VERSION,
  PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4
]);

export const PLUGIN_SNAPSHOT_DOMAINS = [
  "skills",
  "quests",
  "diaries",
  "collectionLog",
  "bossKc",
  "slayer",
  "accountMode",
  "bank"
] as const;

// What v4 adds. Kept out of PLUGIN_SNAPSHOT_DOMAINS on purpose: that constant
// is also the shape check for coverage already stored in the database, and
// every existing row has exactly the eight core domains. Folding these in
// would make normalizePluginSnapshotCoverage reject every pre-v4 row on read —
// the same class of failure as an unbackfilled migration.
export const PLUGIN_SNAPSHOT_V4_DOMAINS = [
  "equipment",
  "farming",
  "combatAchievements"
] as const;

export type PluginSnapshotDomainName = typeof PLUGIN_SNAPSHOT_DOMAINS[number];
export type PluginSnapshotV4DomainName = typeof PLUGIN_SNAPSHOT_V4_DOMAINS[number];
export type PluginSnapshotDomainState =
  | "available"
  | "unavailable"
  | "permission-off"
  | "not-loaded"
  | "unsupported";

export interface PluginSnapshotDomainCoverage {
  state: PluginSnapshotDomainState;
  capturedAt: string | null;
  reason: string | null;
}

export type PluginSnapshotCoverage =
  Record<PluginSnapshotDomainName, PluginSnapshotDomainCoverage>
  & Partial<Record<PluginSnapshotV4DomainName, PluginSnapshotDomainCoverage>>;

export type ParsedPluginSnapshotContract =
  | {
      kind: "legacy";
      contractVersion: null;
      capturedAt: null;
      coverage: null;
    }
  | {
      kind: "v3";
      contractVersion: typeof PLUGIN_SNAPSHOT_CONTRACT_VERSION;
      capturedAt: string;
      coverage: PluginSnapshotCoverage;
    }
  | {
      kind: "v4";
      contractVersion: typeof PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4;
      capturedAt: string;
      coverage: PluginSnapshotCoverage;
    };

/** The tiers as the game names them, lowest to highest. */
export const COMBAT_ACHIEVEMENT_TIERS = [
  "easy", "medium", "hard", "elite", "master", "grandmaster"
] as const;
export type CombatAchievementTier = typeof COMBAT_ACHIEVEMENT_TIERS[number];

export const FARMING_PATCH_STATES = [
  "growing", "ready", "diseased", "dead", "empty"
] as const;
export type FarmingPatchState = typeof FARMING_PATCH_STATES[number];

export type PluginSnapshotContractResult =
  | { ok: true; value: ParsedPluginSnapshotContract }
  | { ok: false; error: string };

const DOMAIN_STATES = new Set<PluginSnapshotDomainState>([
  "available",
  "unavailable",
  "permission-off",
  "not-loaded",
  "unsupported"
]);
const ACCOUNT_TYPES = new Set([
  "normal",
  "ironman",
  "hardcore_ironman",
  "ultimate_ironman",
  "group_ironman",
  "hardcore_group_ironman"
]);
const DIARY_TIERS = new Set(["Easy", "Medium", "Hard", "Elite"]);
const OSRS_RELEASE_MS = Date.parse("2013-02-22T00:00:00.000Z");
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function timestamp(value: unknown, now: number): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed < OSRS_RELEASE_MS || parsed > now + MAX_CLOCK_SKEW_MS) return null;
  return new Date(parsed).toISOString();
}

export function parsePluginSnapshotContract(
  body: Record<string, unknown>,
  now = Date.now()
): PluginSnapshotContractResult {
  if (body.contractVersion === undefined) {
    return {
      ok: true,
      value: { kind: "legacy", contractVersion: null, capturedAt: null, coverage: null }
    };
  }
  if (typeof body.contractVersion !== "number"
    || !PLUGIN_SNAPSHOT_ACCEPTED_CONTRACT_VERSIONS.has(body.contractVersion)) {
    return {
      ok: false,
      error: `Unsupported contractVersion; accepted: ${[...PLUGIN_SNAPSHOT_ACCEPTED_CONTRACT_VERSIONS].join(", ")}`
    };
  }
  const isV4 = body.contractVersion === PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4;
  const capturedAt = timestamp(body.capturedAt, now);
  if (!capturedAt) return { ok: false, error: "capturedAt must be a valid snapshot timestamp" };
  if (!body.coverage || typeof body.coverage !== "object" || Array.isArray(body.coverage)) {
    return { ok: false, error: "coverage must contain every snapshot domain" };
  }

  // A v3 body naming a v4 domain is a bug worth failing loudly on: no v3
  // plugin exists that sends one, so it means a v4 plugin is mislabelling
  // itself — precisely the confusion a version field exists to prevent.
  const requiredDomains: readonly string[] = isV4
    ? [...PLUGIN_SNAPSHOT_DOMAINS, ...PLUGIN_SNAPSHOT_V4_DOMAINS]
    : PLUGIN_SNAPSHOT_DOMAINS;
  const rawCoverage = body.coverage as Record<string, unknown>;
  const unknownDomains = Object.keys(rawCoverage).filter((key) => !requiredDomains.includes(key));
  if (unknownDomains.length > 0) return { ok: false, error: `Unknown coverage domain: ${unknownDomains[0]}` };

  const coverage = {} as PluginSnapshotCoverage;
  for (const domain of requiredDomains as readonly (PluginSnapshotDomainName | PluginSnapshotV4DomainName)[]) {
    const raw = rawCoverage[domain];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `coverage.${domain} is required` };
    }
    const row = raw as Record<string, unknown>;
    if (typeof row.state !== "string" || !DOMAIN_STATES.has(row.state as PluginSnapshotDomainState)) {
      return { ok: false, error: `coverage.${domain}.state is invalid` };
    }
    const state = row.state as PluginSnapshotDomainState;
    const domainCapturedAt = row.capturedAt === undefined ? null : timestamp(row.capturedAt, now);
    const reason = typeof row.reason === "string" && row.reason.trim()
      ? row.reason.trim().slice(0, 100)
      : null;
    if (state === "available" && !domainCapturedAt) {
      return { ok: false, error: `coverage.${domain}.capturedAt is required when available` };
    }
    if (state !== "available" && !reason) {
      return { ok: false, error: `coverage.${domain}.reason is required when not available` };
    }
    if (domainCapturedAt && Date.parse(domainCapturedAt) > Date.parse(capturedAt) + MAX_CLOCK_SKEW_MS) {
      return { ok: false, error: `coverage.${domain}.capturedAt is after the snapshot` };
    }
    coverage[domain] = { state, capturedAt: domainCapturedAt, reason };
  }

  const consistencyError = validateV3PayloadConsistency(body, coverage);
  if (consistencyError) return { ok: false, error: consistencyError };
  if (isV4) {
    const v4Error = validateV4PayloadConsistency(body, coverage, now);
    if (v4Error) return { ok: false, error: v4Error };
    return {
      ok: true,
      value: { kind: "v4", contractVersion: PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4, capturedAt, coverage }
    };
  }
  return {
    ok: true,
    value: { kind: "v3", contractVersion: PLUGIN_SNAPSHOT_CONTRACT_VERSION, capturedAt, coverage }
  };
}

/**
 * The three v4 payloads, held to the same standard as the v3 ones: data may
 * only appear under coverage that claims it, and available coverage must be
 * backed by data of the right shape. Every field is optional in the sense
 * that its coverage may say unavailable — never in the sense of being
 * unchecked.
 */
function validateV4PayloadConsistency(
  body: Record<string, unknown>,
  coverage: PluginSnapshotCoverage,
  now: number
): string | null {
  // Equipment: at most 14 slots exist; 16 leaves slack. Empty is a real state
  // — a naked account is still an observed one — so available coverage
  // requires the array to exist, not to be filled.
  if (coverage.equipment?.state === "available") {
    if (!Array.isArray(body.equipment) || body.equipment.length > 16
      || body.equipment.some((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return true;
        const row = item as Record<string, unknown>;
        return !Number.isInteger(row.id) || (row.id as number) <= 0 || (row.id as number) >= 1_000_000
          || typeof row.name !== "string" || !row.name.trim() || row.name.length > 100
          || !Number.isInteger(row.quantity) || (row.quantity as number) <= 0 || (row.quantity as number) > 2_147_483_647;
      })) {
      return "equipment contains malformed or excessive values";
    }
  } else if (body.equipment !== undefined) {
    return "equipment values require available coverage";
  }

  // Farming: one row per tracked patch. readyAt may sit in the future — that
  // is the whole point of a timer — so it is bounded loosely rather than
  // against the snapshot time.
  if (coverage.farming?.state === "available") {
    if (!Array.isArray(body.farming) || body.farming.length > 64
      || body.farming.some((patch) => {
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) return true;
        const row = patch as Record<string, unknown>;
        if (typeof row.patch !== "string" || !row.patch.trim() || row.patch.length > 64) return true;
        if (row.crop !== null && row.crop !== undefined
          && (typeof row.crop !== "string" || !row.crop.trim() || row.crop.length > 64)) return true;
        if (typeof row.state !== "string"
          || !FARMING_PATCH_STATES.includes(row.state as FarmingPatchState)) return true;
        if (row.readyAt !== null && row.readyAt !== undefined) {
          if (typeof row.readyAt !== "string" || row.readyAt.length > 40) return true;
          const at = Date.parse(row.readyAt);
          // Nothing in the game grows for more than a week.
          if (!Number.isFinite(at) || at < now - 30 * 86_400_000 || at > now + 8 * 86_400_000) return true;
        }
        return false;
      })) {
      return "farming contains malformed or excessive values";
    }
  } else if (body.farming !== undefined) {
    return "farming values require available coverage";
  }

  // Combat Achievements: total points plus the highest completed tier. The
  // cap sits far above the ~2,700 points that exist today so new tasks do not
  // need a contract bump, while still rejecting nonsense.
  if (coverage.combatAchievements?.state === "available") {
    const ca = body.combatAchievements;
    if (!ca || typeof ca !== "object" || Array.isArray(ca)) {
      return "combatAchievements is required when coverage is available";
    }
    const row = ca as Record<string, unknown>;
    if (!Number.isInteger(row.points) || (row.points as number) < 0 || (row.points as number) > 10_000) {
      return "combatAchievements.points is out of range";
    }
    if (row.tier !== null
      && (typeof row.tier !== "string" || !COMBAT_ACHIEVEMENT_TIERS.includes(row.tier as CombatAchievementTier))) {
      return "combatAchievements.tier is invalid";
    }
  } else if (body.combatAchievements !== undefined) {
    return "combatAchievements values require available coverage";
  }

  // Why this sync happened. Metadata, not gameplay state, so no coverage row.
  if (body.syncTrigger !== undefined
    && (typeof body.syncTrigger !== "string"
      || !["manual", "login", "logout", "bank", "timer"].includes(body.syncTrigger))) {
    return "syncTrigger is invalid";
  }
  return null;
}

export function snapshotAvailabilityFromCoverage(coverage: PluginSnapshotCoverage) {
  return {
    skills: coverage.skills.state,
    quests: coverage.quests.state,
    diaries: coverage.diaries.state,
    collectionLog: coverage.collectionLog.state,
    bossKc: coverage.bossKc.state,
    slayer: coverage.slayer.state,
    bank: coverage.bank.state,
    // Only present on v4 snapshots. Spread-style undefined keys would satisfy
    // the type either way; keeping them conditional keeps stored JSON clean.
    ...(coverage.equipment ? { equipment: coverage.equipment.state } : {}),
    ...(coverage.farming ? { farming: coverage.farming.state } : {}),
    ...(coverage.combatAchievements ? { combatAchievements: coverage.combatAchievements.state } : {})
  };
}

export function normalizePluginSnapshotCoverage(value: unknown): PluginSnapshotCoverage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const coverage = {} as PluginSnapshotCoverage;
  // Core domains are required — every row ever stored has them. The v4
  // domains are optional here even though the v4 *parser* requires them,
  // because this function also reads rows written before v4 existed and must
  // not start rejecting them the day the constant list grows.
  for (const domain of [...PLUGIN_SNAPSHOT_DOMAINS, ...PLUGIN_SNAPSHOT_V4_DOMAINS]) {
    const entry = raw[domain];
    if (entry === undefined && (PLUGIN_SNAPSHOT_V4_DOMAINS as readonly string[]).includes(domain)) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.state !== "string" || !DOMAIN_STATES.has(row.state as PluginSnapshotDomainState)) return null;
    const state = row.state as PluginSnapshotDomainState;
    const capturedAt = typeof row.capturedAt === "string" && Number.isFinite(Date.parse(row.capturedAt))
      ? new Date(row.capturedAt).toISOString()
      : null;
    const reason = typeof row.reason === "string" && row.reason.trim() ? row.reason.trim().slice(0, 100) : null;
    if (state === "available" && !capturedAt) return null;
    if (state !== "available" && !reason) return null;
    coverage[domain] = { state, capturedAt, reason };
  }
  return coverage;
}

function validateV3PayloadConsistency(
  body: Record<string, unknown>,
  coverage: PluginSnapshotCoverage
): string | null {
  if (!Array.isArray(body.questsCompleted) || body.questsCompleted.length > 500
    || body.questsCompleted.some((quest) => typeof quest !== "string" || !quest.trim() || quest.length > 100)) {
    return "questsCompleted contains malformed or excessive values";
  }
  if (!Array.isArray(body.diariesCompleted) || body.diariesCompleted.length > 64
    || body.diariesCompleted.some((diary) => {
      if (!diary || typeof diary !== "object" || Array.isArray(diary)) return true;
      const row = diary as Record<string, unknown>;
      return typeof row.region !== "string" || !row.region.trim() || row.region.length > 64
        || typeof row.tier !== "string" || !DIARY_TIERS.has(row.tier);
    })) {
    return "diariesCompleted contains malformed or excessive values";
  }
  if (!Array.isArray(body.collectionLogItemIds) || body.collectionLogItemIds.length > 2000
    || body.collectionLogItemIds.some((id) => !Number.isInteger(id) || (id as number) <= 0 || (id as number) >= 1_000_000)) {
    return "collectionLogItemIds contains malformed or excessive values";
  }
  if (coverage.skills.state === "available") {
    if (!Array.isArray(body.skills) || body.skills.length === 0 || body.skills.length > 32) {
      return "skills cannot be empty or excessive when coverage is available";
    }
    for (const rawSkill of body.skills) {
      if (!rawSkill || typeof rawSkill !== "object" || Array.isArray(rawSkill)) return "skills contains an invalid row";
      const skill = rawSkill as Record<string, unknown>;
      if (typeof skill.name !== "string" || !skill.name.trim()) return "skill name is required";
      if (!Number.isInteger(skill.level) || (skill.level as number) < 1 || (skill.level as number) > 99) {
        return `skill ${skill.name} has an impossible real level`;
      }
      if (!Number.isInteger(skill.xp) || (skill.xp as number) < 0 || (skill.xp as number) > 200_000_000) {
        return `skill ${skill.name} must include exact integer XP`;
      }
      if (realLevelForXp(skill.xp as number) !== skill.level) {
        return `skill ${skill.name} level does not match XP`;
      }
    }
  }

  if (coverage.collectionLog.state === "available") {
    const status = body.collectionLogStatus;
    if (!status || typeof status !== "object" || Array.isArray(status)
      || !Number.isInteger((status as Record<string, unknown>).lastWidgetItemCount)
      || ((status as Record<string, number>).lastWidgetItemCount ?? 0) <= 0) {
      return "collectionLog cannot be available before item slots are loaded";
    }
  }
  if (coverage.bossKc.state === "available") {
    if (!body.bossKc || typeof body.bossKc !== "object" || Array.isArray(body.bossKc)) {
      return "bossKc is required when coverage is available";
    }
    const entries = Object.entries(body.bossKc as Record<string, unknown>);
    if (entries.length === 0 || entries.length > 128 || entries.some(([name, kc]) =>
      !name.trim() || name.length > 80 || !Number.isInteger(kc) || (kc as number) < 0 || (kc as number) > 2_147_483_647)) {
      return "bossKc contains malformed or excessive values";
    }
  }
  if (coverage.bossKc.state !== "available" && body.bossKc !== undefined) {
    return "bossKc values require available coverage";
  }
  if (coverage.slayer.state === "available"
    && (!body.slayer || typeof body.slayer !== "object" || Array.isArray(body.slayer))) {
    return "slayer is required when coverage is available";
  }
  if (coverage.slayer.state === "available") {
    const slayer = body.slayer as Record<string, unknown>;
    const numericFields: Array<[string, number]> = [
      ["points", 1_000_000],
      ["streak", 100_000],
      ["taskRemaining", 500],
      ["currentTaskId", 10_000]
    ];
    if (numericFields.some(([key, maximum]) =>
      !Number.isInteger(slayer[key]) || (slayer[key] as number) < 0 || (slayer[key] as number) > maximum)) {
      return "slayer contains impossible numeric values";
    }
    if (!Array.isArray(slayer.blocks) || slayer.blocks.length > 12
      || slayer.blocks.some((id) => !Number.isInteger(id) || (id as number) <= 0)) {
      return "slayer blocks are malformed";
    }
  }
  if (coverage.accountMode.state === "available"
    && (typeof body.accountType !== "string" || !ACCOUNT_TYPES.has(body.accountType))) {
    return "accountType is invalid when accountMode coverage is available";
  }

  const bankStatus = body.bankStatus;
  const bankItems = Array.isArray(body.bankItems) ? body.bankItems : [];
  if (bankItems.length > 1200 || bankItems.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    const row = item as Record<string, unknown>;
    return !Number.isInteger(row.id) || (row.id as number) <= 0 || (row.id as number) >= 1_000_000
      || typeof row.name !== "string" || !row.name.trim() || row.name.length > 100
      || !Number.isInteger(row.quantity) || (row.quantity as number) <= 0 || (row.quantity as number) > 2_147_483_647;
  })) {
    return "bankItems contains malformed or excessive values";
  }
  if (coverage.bank.state === "available") {
    if (!bankStatus || typeof bankStatus !== "object" || Array.isArray(bankStatus)
      || (bankStatus as Record<string, unknown>).enabled !== true
      || ((bankStatus as Record<string, unknown>).unavailableReason ?? null) !== null
      || !Number.isInteger((bankStatus as Record<string, unknown>).itemCount)
      || (bankStatus as Record<string, unknown>).itemCount !== bankItems.length) {
      return "bank status contradicts available coverage";
    }
  }
  if (coverage.bank.state === "permission-off") {
    if (bankItems.length > 0 || !bankStatus || typeof bankStatus !== "object" || Array.isArray(bankStatus)
      || (bankStatus as Record<string, unknown>).enabled !== false) {
      return "bank items cannot be sent when bank permission is off";
    }
  }
  return null;
}

/** RuneLite reports real levels; virtual levels above 99 must remain level 99. */
export function realLevelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let points = 0;
  for (let level = 1; level < 99; level += 1) {
    points += Math.floor(level + 300 * 2 ** (level / 7));
    const threshold = Math.floor(points / 4);
    if (xp < threshold) return level;
  }
  return 99;
}
