export const PLUGIN_SNAPSHOT_CONTRACT_VERSION = 3 as const;

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

export type PluginSnapshotDomainName = typeof PLUGIN_SNAPSHOT_DOMAINS[number];
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

export type PluginSnapshotCoverage = Record<PluginSnapshotDomainName, PluginSnapshotDomainCoverage>;

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
    };

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
  if (body.contractVersion !== PLUGIN_SNAPSHOT_CONTRACT_VERSION) {
    return { ok: false, error: `Unsupported contractVersion; expected ${PLUGIN_SNAPSHOT_CONTRACT_VERSION}` };
  }
  const capturedAt = timestamp(body.capturedAt, now);
  if (!capturedAt) return { ok: false, error: "capturedAt must be a valid snapshot timestamp" };
  if (!body.coverage || typeof body.coverage !== "object" || Array.isArray(body.coverage)) {
    return { ok: false, error: "coverage must contain every snapshot domain" };
  }

  const rawCoverage = body.coverage as Record<string, unknown>;
  const unknownDomains = Object.keys(rawCoverage).filter((key) =>
    !PLUGIN_SNAPSHOT_DOMAINS.includes(key as PluginSnapshotDomainName));
  if (unknownDomains.length > 0) return { ok: false, error: `Unknown coverage domain: ${unknownDomains[0]}` };

  const coverage = {} as PluginSnapshotCoverage;
  for (const domain of PLUGIN_SNAPSHOT_DOMAINS) {
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
  return {
    ok: true,
    value: { kind: "v3", contractVersion: PLUGIN_SNAPSHOT_CONTRACT_VERSION, capturedAt, coverage }
  };
}

export function snapshotAvailabilityFromCoverage(coverage: PluginSnapshotCoverage) {
  return {
    skills: coverage.skills.state,
    quests: coverage.quests.state,
    diaries: coverage.diaries.state,
    collectionLog: coverage.collectionLog.state,
    bossKc: coverage.bossKc.state,
    slayer: coverage.slayer.state,
    bank: coverage.bank.state
  };
}

export function normalizePluginSnapshotCoverage(value: unknown): PluginSnapshotCoverage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const coverage = {} as PluginSnapshotCoverage;
  for (const domain of PLUGIN_SNAPSHOT_DOMAINS) {
    const entry = raw[domain];
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
