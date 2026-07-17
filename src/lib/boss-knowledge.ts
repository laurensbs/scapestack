import type { CombatStyle } from "./gear";
import type { Boss } from "./bosses";

export type BossSupportLevel = "full" | "guided" | "estimate";
export type BossEncounterType = "solo" | "phase" | "group" | "raid" | "wave" | "activity";
export type BossSupplyPressure = "low" | "medium" | "high" | "full-run";
export type BossDeathRisk = "low" | "medium" | "high" | "extreme";
export type BossDpsModel = "single-target" | "phase-switch" | "multi-role" | "room-by-room" | "wave" | "not-applicable";
export type BossGpDataState = "rough" | "volatile" | "not-modeled" | "not-applicable";

export interface BossKnowledge {
  bossSlug: string;
  support: BossSupportLevel;
  encounterType: BossEncounterType;
  groupSize: string;
  combatStyles: CombatStyle[];
  hardRequirements: string[];
  setupBands: {
    minimum: string;
    comfortable: string;
    strong: string;
  };
  mandatoryItems: string[];
  inventoryArchetype: string;
  supplyPressure: BossSupplyPressure;
  deathRisk: BossDeathRisk;
  wildernessRisk: boolean;
  stopPoint: string;
  gpData: {
    state: BossGpDataState;
    note: string;
  };
  dpsModel: BossDpsModel;
  playerLine: string;
}

type BossKnowledgeProfileId =
  | "full-solo"
  | "full-phase"
  | "guided-solo"
  | "guided-gwd"
  | "guided-wildy"
  | "estimate-group"
  | "estimate-raid"
  | "guided-wave"
  | "estimate-wave"
  | "guided-activity";

type KnowledgeProfile = Omit<BossKnowledge, "bossSlug" | "combatStyles">;

const PROFILES: Record<BossKnowledgeProfileId, KnowledgeProfile> = {
  "full-solo": {
    support: "full",
    encounterType: "solo",
    groupSize: "Solo",
    hardRequirements: [],
    setupBands: {
      minimum: "A usable main weapon, protection prayers and one safe inventory.",
      comfortable: "A proven main weapon, matching armour, restores and a fast reset.",
      strong: "High-accuracy gear, a useful spec and supplies for repeated trips."
    },
    mandatoryItems: [],
    inventoryArchetype: "Main style, boost, restores, food and one-click teleport.",
    supplyPressure: "medium",
    deathRisk: "medium",
    wildernessRisk: false,
    stopPoint: "Do one kill or one short trip, then judge supply use before camping.",
    gpData: { state: "rough", note: "Rough loot value; verify current prices before a long camp." },
    dpsModel: "single-target",
    playerLine: "Bank-aware first trip. Mechanics can still change real kill speed."
  },
  "full-phase": {
    support: "full",
    encounterType: "phase",
    groupSize: "Solo",
    hardRequirements: [],
    setupBands: {
      minimum: "A viable weapon for every required phase and enough supplies for one attempt.",
      comfortable: "Compact switches, reliable restores and a clean emergency teleport.",
      strong: "Fast switches, phase-specific upgrades and room for extra damage supplies."
    },
    mandatoryItems: [],
    inventoryArchetype: "Phase switches, restores, food, utility and a fast reset.",
    supplyPressure: "high",
    deathRisk: "medium",
    wildernessRisk: false,
    stopPoint: "Do one full encounter; stop if a phase or switch is still unstable.",
    gpData: { state: "rough", note: "Rough encounter value; rotations and mistakes change the real rate." },
    dpsModel: "phase-switch",
    playerLine: "Multiple phases matter. Use the setup as a starting route, not one final DPS number."
  },
  "guided-solo": {
    support: "guided",
    encounterType: "solo",
    groupSize: "Solo",
    hardRequirements: [],
    setupBands: {
      minimum: "A viable weapon and enough supplies for one careful attempt.",
      comfortable: "A matching setup with reliable food, restores and reset route.",
      strong: "Encounter-specific gear after the first successful trip."
    },
    mandatoryItems: [],
    inventoryArchetype: "Main style, basic utility, food, restores and teleport.",
    supplyPressure: "medium",
    deathRisk: "medium",
    wildernessRisk: false,
    stopPoint: "Use one learner kill as the stop point; check the guide before repeating.",
    gpData: { state: "rough", note: "Static rough loot value, not a live profit promise." },
    dpsModel: "single-target",
    playerLine: "Useful first-trip check. Confirm encounter mechanics before buying upgrades."
  },
  "guided-gwd": {
    support: "guided",
    encounterType: "group",
    groupSize: "Solo or small team",
    hardRequirements: ["God Wars Dungeon access", "Required kill count or bypass"],
    setupBands: {
      minimum: "A role-appropriate weapon, protection gear and one-entry supplies.",
      comfortable: "Sustain gear, restores, emergency teleport and a known method.",
      strong: "Method-specific solo gear or a defined team role."
    },
    mandatoryItems: ["God protection", "Emergency teleport"],
    inventoryArchetype: "Protection item, role gear, restores, food and sustain utility.",
    supplyPressure: "high",
    deathRisk: "high",
    wildernessRisk: false,
    stopPoint: "Stop after one entry or when sustain breaks down; do not infer a full trip from boss DPS alone.",
    gpData: { state: "volatile", note: "Unique-heavy value; team size and trip length dominate actual profit." },
    dpsModel: "multi-role",
    playerLine: "Choose a method and role first. One weapon score cannot predict the whole trip."
  },
  "guided-wildy": {
    support: "guided",
    encounterType: "solo",
    groupSize: "Solo or team at multi bosses",
    hardRequirements: ["Wilderness access and an escape plan"],
    setupBands: {
      minimum: "Low-risk weapon, minimal supplies and a tested escape.",
      comfortable: "Disposable risk, correct protection and instant teleport where allowed.",
      strong: "Only upgrades that remain worth risking after a death."
    },
    mandatoryItems: ["Escape plan", "Only risk what you accept losing"],
    inventoryArchetype: "Low-risk gear, short supplies, anti-PK utility and escape teleport.",
    supplyPressure: "medium",
    deathRisk: "extreme",
    wildernessRisk: true,
    stopPoint: "Try one low-risk kill and leave immediately when the route feels exposed.",
    gpData: { state: "volatile", note: "Loot can be strong, but deaths and interruptions can erase the rate." },
    dpsModel: "single-target",
    playerLine: "Risk comes before DPS. Keep the first trip cheap and short."
  },
  "estimate-group": {
    support: "estimate",
    encounterType: "group",
    groupSize: "Team or specialist solo",
    hardRequirements: ["Encounter access", "A defined team role or specialist method"],
    setupBands: {
      minimum: "Learner-team requirements and role gear.",
      comfortable: "A defined role, coordinated supplies and tested switches.",
      strong: "Team-standard gear for the chosen scale and method."
    },
    mandatoryItems: ["Role-specific setup", "Team plan"],
    inventoryArchetype: "Role gear, switches, shared strategy supplies and emergency reset.",
    supplyPressure: "high",
    deathRisk: "high",
    wildernessRisk: false,
    stopPoint: "Use one learner attempt; do not camp from this estimate alone.",
    gpData: { state: "not-modeled", note: "Team size, splits and role performance are not modeled." },
    dpsModel: "multi-role",
    playerLine: "Role check only. Team scale matters more than a single simulated weapon."
  },
  "estimate-raid": {
    support: "estimate",
    encounterType: "raid",
    groupSize: "Solo or team; scale changes the encounter",
    hardRequirements: ["Raid access", "Role-appropriate switches", "A learner route"],
    setupBands: {
      minimum: "Learner switches for every required combat style.",
      comfortable: "Compact switches, raid supplies and a practiced room order.",
      strong: "Scale-specific gear, specs and role allocation."
    },
    mandatoryItems: ["Multiple combat styles", "Raid-specific utility"],
    inventoryArchetype: "Multi-style switches, specs, restores, raid utility and room supplies.",
    supplyPressure: "full-run",
    deathRisk: "high",
    wildernessRisk: false,
    stopPoint: "Complete one learner raid or scout; review the weak room before another run.",
    gpData: { state: "not-modeled", note: "Points, scale, deaths and splits are required for a meaningful rate." },
    dpsModel: "room-by-room",
    playerLine: "Learner checklist only. Scapestack will not reduce the raid to one DPS or GP/hour number."
  },
  "guided-wave": {
    support: "guided",
    encounterType: "wave",
    groupSize: "Solo",
    hardRequirements: ["Full wave encounter access"],
    setupBands: {
      minimum: "Enough gear and supplies for the full wave run, not only the final boss.",
      comfortable: "Reliable wave solves, restores and emergency food.",
      strong: "Supply-efficient wave gear with a practiced final-boss setup."
    },
    mandatoryItems: ["Full-run supplies"],
    inventoryArchetype: "Wave sustain, restores, food, utility and final-boss gear.",
    supplyPressure: "full-run",
    deathRisk: "high",
    wildernessRisk: false,
    stopPoint: "Treat one full attempt as the stop point; boss DPS alone is not readiness.",
    gpData: { state: "not-applicable", note: "This is an unlock/completion encounter, not a GP route." },
    dpsModel: "wave",
    playerLine: "Full-run readiness matters. The final boss is only one part of the attempt."
  },
  "estimate-wave": {
    support: "estimate",
    encounterType: "wave",
    groupSize: "Solo",
    hardRequirements: ["Endgame wave access", "A practiced wave and supply plan"],
    setupBands: {
      minimum: "A proven learner setup for the complete encounter.",
      comfortable: "Wave-specific switches, solves and supply targets.",
      strong: "Endgame gear plus repeatable mechanics across the full run."
    },
    mandatoryItems: ["Full-run supplies", "Encounter-specific switches"],
    inventoryArchetype: "Full-run switch plan, sustain, restores and encounter utility.",
    supplyPressure: "full-run",
    deathRisk: "extreme",
    wildernessRisk: false,
    stopPoint: "Plan one serious attempt; use a specialist guide before committing supplies.",
    gpData: { state: "not-applicable", note: "Completion value cannot be derived from final-boss DPS." },
    dpsModel: "wave",
    playerLine: "Specialist encounter. This bank check cannot certify full-run readiness."
  },
  "guided-activity": {
    support: "guided",
    encounterType: "activity",
    groupSize: "Solo or public group",
    hardRequirements: ["Activity access and required skilling level"],
    setupBands: {
      minimum: "Required tools and enough food or utility for one round.",
      comfortable: "Activity clothing, better tools and a reliable reward loop.",
      strong: "Efficient skilling setup matched to the chosen strategy."
    },
    mandatoryItems: ["Activity tools"],
    inventoryArchetype: "Tools, activity utility, food when relevant and reward reset.",
    supplyPressure: "low",
    deathRisk: "low",
    wildernessRisk: false,
    stopPoint: "Do one round, crate or reward pull, then adjust the setup.",
    gpData: { state: "not-applicable", note: "Rewards depend on contribution and activity strategy." },
    dpsModel: "not-applicable",
    playerLine: "Activity prep, not combat DPS. Check tools and one-round supplies."
  }
};

const PROFILE_BOSSES: Record<BossKnowledgeProfileId, readonly string[]> = {
  "full-solo": [
    "vorkath", "kraken", "cerberus", "hespori", "vardorvis", "giant-mole",
    "sarachnis", "obor", "bryophyta", "amoxliatl", "araxxor"
  ],
  "full-phase": [
    "zulrah", "hydra", "phantom-muspah", "kalphite-queen",
    "grotesque-guardians", "demonic-gorillas", "moons-of-peril", "barrows"
  ],
  "guided-solo": [
    "sire", "thermonuclear", "skotizo", "mimic", "leviathan",
    "duke-sucellus", "whisperer", "galvek", "dks-rex", "dks-supreme",
    "dks-prime", "deranged-archaeologist"
  ],
  "guided-gwd": ["graardor", "kree", "zilyana", "kril"],
  "guided-wildy": [
    "callisto", "venenatis", "vetion", "calvarion", "spindel", "artio",
    "scorpia", "chaos-elemental", "chaos-fanatic", "crazy-archaeologist",
    "king-black-dragon", "kbd"
  ],
  "estimate-group": ["nex", "corp", "hueycoatl"],
  "estimate-raid": ["cox", "tob", "toa"],
  "guided-wave": ["tztok-jad"],
  "estimate-wave": ["tzkal-zuk", "fortis-colosseum"],
  "guided-activity": ["zalcano", "wintertodt", "tempoross", "guardians-of-the-rift"]
};

const REQUIREMENT_OVERRIDES: Record<string, string[]> = {
  vorkath: ["Dragon Slayer II", "Anti-dragon protection"],
  zulrah: ["Regicide access"],
  hydra: ["95 Slayer", "Alchemical Hydra task"],
  sire: ["85 Slayer", "Abyssal demon task"],
  kraken: ["87 Slayer", "Cave kraken task"],
  cerberus: ["91 Slayer", "Hellhound task"],
  thermonuclear: ["93 Slayer", "Smoke devil task"],
  "grotesque-guardians": ["75 Slayer", "Gargoyle task", "Brittle key"],
  vardorvis: ["Desert Treasure II"],
  leviathan: ["Desert Treasure II"],
  "duke-sucellus": ["Desert Treasure II"],
  whisperer: ["Desert Treasure II"],
  "phantom-muspah": ["Secrets of the North"],
  galvek: ["Dragon Slayer II quest encounter"],
  "dks-rex": ["Waterbirth Island access", "Pet rock or teammate for the dungeon doors"],
  "dks-supreme": ["Waterbirth Island access", "Pet rock or teammate for the dungeon doors"],
  "dks-prime": ["Waterbirth Island access", "Pet rock or teammate for the dungeon doors"],
  "king-black-dragon": ["Wilderness route to the KBD lair", "Anti-dragon protection"],
  kbd: ["Wilderness route to the KBD lair", "Anti-dragon protection"],
  araxxor: ["92 Slayer", "Araxyte task"],
  hueycoatl: ["Team or specialist solo method"],
  "moons-of-peril": ["Perilous Moons access"],
  barrows: ["Priest in Peril", "Spade"],
  hespori: ["65 Farming", "Hespori seed grown"],
  "tztok-jad": ["Fight Caves access"],
  "tzkal-zuk": ["Inferno access"],
  "fortis-colosseum": ["Fortis Colosseum access"],
  wintertodt: ["50 Firemaking"],
  tempoross: ["35 Fishing"],
  "guardians-of-the-rift": ["Temple of the Eye"],
  zalcano: ["Song of the Elves"]
};

const MANDATORY_OVERRIDES: Record<string, string[]> = {
  vorkath: ["Anti-dragon protection", "Antifire", "Crumble Undead"],
  zulrah: ["Venom protection", "Required combat switches"],
  hydra: ["Boots of stone protection for Karuulm access"],
  "kalphite-queen": ["Rope for first access"],
  "grotesque-guardians": ["Rock hammer", "Required style switches"],
  "phantom-muspah": ["Prayer restores", "Shield-phase answer"],
  barrows: ["Spade"],
  hespori: ["Farming tools"],
  "king-black-dragon": ["Anti-dragon protection", "Antifire"],
  kbd: ["Anti-dragon protection", "Antifire"]
};

const STOP_OVERRIDES: Record<string, string> = {
  vorkath: "Stop after one kill until acid movement, spawn and supply use are clean.",
  zulrah: "Stop after one rotation attempt; fix switches before using another inventory.",
  hydra: "Stop after one kill or one failed phase cycle; mechanics matter more than paper DPS.",
  barrows: "Stop after one chest and check prayer, tunnel time and return teleport.",
  hespori: "Stop after the single available kill.",
  "dks-rex": "Stop after one safe Rex cycle; do not turn a safespot check into a tribrid claim.",
  "dks-supreme": "Stop after one rotation and confirm the other kings stay controlled.",
  "dks-prime": "Stop after one rotation and confirm the other kings stay controlled."
};

const COMBAT_STYLE_OVERRIDES: Partial<Record<string, CombatStyle[]>> = {
  cox: ["crush", "ranged", "magic"],
  tob: ["slash", "ranged", "magic"],
  toa: ["stab", "ranged", "magic"],
  "moons-of-peril": ["slash", "stab", "magic", "ranged"]
};

const BOSS_KNOWLEDGE_BY_SLUG = new Map<string, BossKnowledge>();
for (const [profileId, slugs] of Object.entries(PROFILE_BOSSES) as Array<[BossKnowledgeProfileId, readonly string[]]>) {
  const profile = PROFILES[profileId];
  for (const bossSlug of slugs) {
    if (BOSS_KNOWLEDGE_BY_SLUG.has(bossSlug)) throw new Error(`Duplicate boss knowledge: ${bossSlug}`);
    BOSS_KNOWLEDGE_BY_SLUG.set(bossSlug, {
      bossSlug,
      ...profile,
      combatStyles: [],
      hardRequirements: REQUIREMENT_OVERRIDES[bossSlug] ?? [...profile.hardRequirements],
      mandatoryItems: MANDATORY_OVERRIDES[bossSlug] ?? [...profile.mandatoryItems],
      stopPoint: STOP_OVERRIDES[bossSlug] ?? profile.stopPoint
    });
  }
}

export function bossKnowledge(boss: Boss): BossKnowledge {
  const entry = BOSS_KNOWLEDGE_BY_SLUG.get(boss.slug);
  if (!entry) throw new Error(`Boss knowledge is missing for ${boss.slug}`);
  return {
    ...entry,
    combatStyles: COMBAT_STYLE_OVERRIDES[boss.slug] ?? [...boss.weaknesses]
  };
}

export function bossKnowledgeSupportsSingleDps(entry: BossKnowledge): boolean {
  return entry.dpsModel === "single-target";
}

export function bossKnowledgeAllowsGpRate(entry: BossKnowledge): boolean {
  return bossKnowledgeSupportsSingleDps(entry)
    && (entry.gpData.state === "rough" || entry.gpData.state === "volatile");
}

export function bossKnowledgeRankingAdjustment(entry: BossKnowledge): number {
  const support = entry.support === "full" ? 8 : entry.support === "guided" ? 0 : -22;
  const risk = entry.deathRisk === "low" ? 4 : entry.deathRisk === "medium" ? 0 : entry.deathRisk === "high" ? -10 : -28;
  const model = bossKnowledgeSupportsSingleDps(entry) ? 0 : entry.dpsModel === "phase-switch" ? -6 : -16;
  return support + risk + model;
}
