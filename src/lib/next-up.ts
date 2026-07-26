// "What to do now" — the recommendation engine behind the /next hub.
//
// Plenty of OSRS players hit a wall: maxed-ish stats, a full bank, and no
// idea what to chase. This module turns the data the toolkit already has —
// live Hiscores skill levels + the player's pasted bank + the curated goal
// sets + the boss roster — into a short, ranked list of concrete next steps.
//
// Each recommendation carries a `score` (higher = surface sooner), a plain
// `why`, an optional payoff, and a `link` into whichever existing tool the
// player would use to act on it. The hub renders one headline pick plus the
// rest as a checklist.

import {
  GOAL_SETS, checkCompletion, normaliseCompletion, overallStats, closestToComplete,
  type CompletionItem, type SetCompletion
} from "./goals";
import { hoursToMax } from "./hours-to-max";
import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "./hiscores";
import { getQuests, questSlug, type QuestRecord } from "./quest-db";
import { getDiaries } from "./diary-db";
import { diaryTierKey } from "./diary-requirements";
import { getDropRates } from "./drop-rates-db";
import { computePathProgress, type AccountMeta, type PathOverview } from "./path-progress";
import { detectAccountStage, type AccountStage } from "./account-stage";
import { skillCapeId } from "./skill-capes";
import { buildSkillRoute, ROUTABLE_SKILLS, skillRouteNeeds, skillRoutePlanSeed } from "./skill-routes";
import { resolveSlayerTaskMonsterId } from "./slayer/task-ids";
import { MONSTERS_BY_ID } from "./slayer/monsters";
import { slayerUrlForSyncedRsn } from "./plugin-sync-actions";
import { decideSlayerTask } from "./slayer-task-decision";
import {
  normalizeScapestackAccountType,
  resolveAccountMode,
  scapestackAccountTypeToPlannerType,
  type PlannerAccountType
} from "./account-type";
import type { SyncDeltaSummary } from "./sync-repo";
import { pluginSyncHealth } from "./plugin-sync";
import { latestActivity } from "./returning-player";
import { isIronAccount, rankRecommendations } from "./next-up-scoring";
import { completedQuest, lvl } from "./next-up-shared";
import { minigameRecs } from "./next-up-minigames";
import { moneyRecs } from "./next-up-money";
import { applyBossViability, bossRecs } from "./next-up-bosses";
import { QUEST_CAPE_QP_THRESHOLD, nextBestActions, questRecs } from "./next-up-quests";
import { diaryRecs } from "./next-up-diaries";
import { activeBossKcRecs, kcRecs } from "./next-up-kc";
import { withActionPlans } from "./next-up-action-plan";
import { accessNeedsLine, evaluateAccess, type AccessContext } from "./content-access";

// The public contract lives in next-up-types.ts. Re-exported here so every
// existing `from "@/lib/next-up"` import keeps resolving.
export type {
  RecKind,
  RecommendationPlanSeed,
  RecommendationRouteTag,
  RecommendationGearConfidence,
  RecommendationQuality,
  RecommendationActionPlan,
  RecommendationRouteChainLabel,
  RecommendationRouteChainStep,
  RecommendationRouteChain,
  RecommendationCompletionTarget,
  Recommendation,
  ReturnPlan,
  NextBestActionKind,
  NextBestActionPreparation,
  NextBestAction,
  NextUpInput,
  NextUpResult
} from "./next-up-types";

import type {
  RecKind,
  RecommendationRouteTag,
  Recommendation,
  ReturnPlan,
  NextBestAction,
  NextUpInput,
  NextUpResult
} from "./next-up-types";

// Skill milestones worth nudging a player toward — levels that unlock
// meaningful content or are satisfying round numbers. Within a few levels of
// one of these, the engine suggests pushing for it.
const SKILL_MILESTONES: Record<string, { level: number; unlock: string; maxGap?: number }[]> = {
  Slayer:  [{ level: 70, unlock: "Kurasks + real mid-game Slayer rhythm", maxGap: 25 }, { level: 85, unlock: "Abyssal demons → whip" }, { level: 93, unlock: "Cryptic clue tasks" }, { level: 99, unlock: "Slayer cape" }],
  Agility: [{ level: 90, unlock: "Ardougne rooftop course" }, { level: 99, unlock: "Agility cape" }],
  Herblore:[{ level: 78, unlock: "Magic potions" }, { level: 90, unlock: "Extended antifire" }, { level: 99, unlock: "Herblore cape" }],
  Farming: [{ level: 83, unlock: "Magic trees + Hespori" }, { level: 99, unlock: "Farming cape" }],
  Mining:  [{ level: 92, unlock: "Amethyst" }, { level: 99, unlock: "Mining cape" }],
  Prayer:  [{ level: 70, unlock: "Piety", maxGap: 20 }, { level: 77, unlock: "Rigour/Augury (with quests)" }, { level: 99, unlock: "Prayer cape" }],
  Construction: [{ level: 83, unlock: "Nexus / max POH" }, { level: 99, unlock: "Construction cape" }],
  Sailing: [{ level: 50, unlock: "mid-level voyages" }, { level: 75, unlock: "late-route progression" }, { level: 99, unlock: "Sailing cape" }]
};



// ── Recommendation sources ──────────────────────────────────────────────────

// Goal sets the player is 1-2 items away from completing — the highest-value,
// most actionable thing for a stuck player. Closer = higher score.
function goalRecs(completions: SetCompletion[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const c of completions) {
    const set = GOAL_SETS.find((s) => s.id === c.setId);
    if (!set) continue;
    const norm = normaliseCompletion(c, set);
    if (!norm.earnedAny || norm.complete) continue;
    const missing = norm.max - norm.progress;
    if (missing > 3) continue; // only "almost there" sets
    const missingGoals = set.goals
      .filter((g) => !c.perGoal[g.id]?.satisfied)
      .map((g) => g.name)
      .slice(0, 3);
    // 1 item left scores highest; each extra item missing drops it sharply.
    const score = 92 - (missing - 1) * 16;
    recs.push({
      id: `goal:${set.id}`,
      kind: "goal",
      title: `Finish ${set.name}`,
      why: missing === 1
        ? "You're one item away from completing this set."
        : `Only ${missing} items left in this set.`,
      payoff: set.description,
      decisionReason: missingGoals[0]
        ? `${missingGoals[0]} is the closest missing piece; finishing it changes the account immediately.`
        : missing === 1
          ? "One missing piece makes this the cleanest account progress right now."
          : `${missing} missing pieces keeps this finite enough for a focused session.`,
      score,
      link: "/goals",
      iconItemId: set.iconItemId,
      routeTags: ["unlock", "maxing"],
      gearConfidence: "likely",
      quality: {
        accountFit: missing === 1 ? 0.9 : 0.8,
        actionability: missing === 1 ? 0.82 : 0.72,
        stopPoint: missing === 1 ? 0.9 : 0.8,
        gearConfidence: 0.78,
        unlockValue: 0.9,
        fun: 0.68,
        friction: missing === 1 ? 0.22 : 0.34
      },
      planSeed: {
        timebox: missing === 1 ? "30-60 min" : "1-2 sessions",
        prep: missingGoals.length > 0
          ? `Missing: ${missingGoals.join(", ")}.`
          : `Close to completion: ${norm.progress}/${norm.max}.`,
        steps: [
          `Open the ${set.name} goal set and confirm the missing ${missing === 1 ? "piece" : "pieces"}.`,
          missingGoals[0] ? `Target ${missingGoals[0]} first — it is the shortest visible path to progress.` : "Pick the missing piece with the lowest travel/setup cost.",
          "Sync again after the drop or unlock so the set disappears from your plan."
        ]
      }
    });
  }
  return recs;
}


const LOW_ATTENTION_MILESTONE_SKILLS = new Set(["Fishing", "Mining", "Woodcutting"]);

// Skills sitting just short of a milestone level — a clear, finite push.
function skillRecs(
  skills: HiscoreSkill[],
  bank: CompletionItem[],
  accountType: PlannerAccountType | null
): Recommendation[] {
  const recs: Recommendation[] = [];
  const combatLevel = computeCombatLevel(skills);
  for (const [skill, milestones] of Object.entries(SKILL_MILESTONES)) {
    const level = lvl(skills, skill);
    for (const m of milestones) {
      const gap = m.level - level;
      const maxGap = m.maxGap ?? 5;
      if (gap <= 0 || gap > maxGap) continue;
      const nearMilestone = gap <= 5;
      const returningSlayerFoundation = skill === "Slayer"
        && m.level === 70
        && level >= 45
        && level < 70
        && combatLevel !== null
        && combatLevel >= 75;
      const skillState = skills.find((entry) => entry.name === skill);
      const route = skillState
        ? buildSkillRoute({
            skill: skillState,
            targetLevel: m.level,
            bank: bank.length > 0 ? bank : undefined,
            accountType,
            skills,
            unlock: m.unlock
          })
        : null;
      recs.push({
        id: `skill:${skill}:${m.level}`,
        kind: "skill",
        title: `Push ${skill} to ${m.level}`,
        why: route
          ? `${gap} level${gap === 1 ? "" : "s"} away · ${route.xpRemaining.toLocaleString()} XP to ${m.unlock}.`
          : `You're ${gap} level${gap === 1 ? "" : "s"} away.`,
        payoff: `Unlocks: ${m.unlock}`,
        decisionReason: route?.recommended
          ? `${route.recommended.method.name} gives this ${skill} push a clear ${route.shortSession.minutes}-minute stop point.`
          : gap <= 2
            ? `${skill} ${m.level} is within ${gap} level${gap === 1 ? "" : "s"}; stop as soon as the unlock lands.`
            : `${skill} ${m.level} is close enough to be a clean AFK or focused backup.`,
        // Close milestones can compete with diaries. Longer foundation
        // pushes (Slayer 50→70, Prayer 52→70) stay visible but do not
        // outrank immediately actionable unlocks.
        score: returningSlayerFoundation
          ? 76
          : nearMilestone
            ? 78 - gap * 6
            : 66 - Math.min(8, Math.floor((gap - 6) / 3)),
        link: "/goals",
        // Per-skill cape sprite — Slayer cape for 'Push Slayer', not the
        // generic Attack cape stand-in that was shipping before.
        iconItemId: skillCapeId(skill),
        needs: route ? skillRouteNeeds(route) : undefined,
        completionTarget: { kind: "skill_level_at_least", skill, target: m.level },
        routeTags: [
          "maxing",
          ...(LOW_ATTENTION_MILESTONE_SKILLS.has(skill) ? ["afk" as const] : []),
          ...(skill === "Slayer" ? ["slayer" as const, "pvm" as const] : []),
          ...(skill === "Agility" || skill === "Farming" || skill === "Mining" ? ["skiller" as const] : [])
        ],
        quality: {
          accountFit: 0.8,
          actionability: nearMilestone ? 0.88 : 0.72,
          stopPoint: nearMilestone ? 0.92 : 0.76,
          gearConfidence: 0.96,
          unlockValue: m.level === 99 ? 0.82 : 0.76,
          fun: skill === "Slayer" ? 0.72 : 0.58,
          friction: nearMilestone ? 0.18 : 0.3
        },
        planSeed: route ? skillRoutePlanSeed(route) : {
          timebox: gap <= 2 ? "30-60 min" : "1-2 sessions",
          prep: `${skill} ${level} → ${m.level}: only ${gap} level${gap === 1 ? "" : "s"} for ${m.unlock}.`,
          steps: [
            `Train ${skill} until level ${m.level}, then stop — the unlock is the point.`,
            "Buy or bank supplies for only the gap so you do not overcommit GP/time.",
            "Check your plan again immediately; this level may unlock quests, diaries or bosses."
          ]
        }
      });
      break; // only the nearest milestone per skill
    }
  }
  return recs;
}

// ── Money-making methods ────────────────────────────────────────────────────
// A curated shortlist of solid GP/hr methods with stat gates. Values are
// representative community averages (Wiki MMG, RuneScape.wiki Money making
// guide) — they fluctuate with the GE and aren't precise, so the card frames
// them as an order of magnitude ("~", "k", "M") rather than fake precision.
//
// Each entry's `req` lists the relevant skill gates; ALL must be met. Entries
// are intentionally diverse: AFK / active, combat / skilling, low / high tier.

function slayerTaskRecs(
  slayer: NonNullable<NextUpInput["scapestackSync"]>["slayer"] | undefined,
  context: {
    displayName?: string;
    bank: CompletionItem[];
    accountType: PlannerAccountType | null;
    combatLevel: number | null;
    slayerLevel: number | null;
    syncHealth: ReturnType<typeof pluginSyncHealth> | "unknown";
  }
): Recommendation[] {
  if (!slayer || slayer.taskRemaining <= 0) return [];
  const slug = resolveSlayerTaskMonsterId(slayer.taskName, slayer.currentTaskId);
  const monster = slug ? MONSTERS_BY_ID.get(slug) : undefined;
  if (!monster) return [];

  const decision = decideSlayerTask({
    task: monster,
    state: slayer,
    bank: context.bank,
    accountType: context.accountType,
    combatLevel: context.combatLevel,
    slayerLevel: context.slayerLevel,
    syncHealth: context.syncHealth
  });
  if (decision.verdict === "refresh") return [];

  const taskXp = Math.max(0, monster.hp * 4 * slayer.taskRemaining);
  const taskLeftLabel = `${slayer.taskRemaining.toLocaleString()} ${monster.name}${slayer.taskRemaining === 1 ? "" : "s"}`;
  const title = decision.verdict === "skip"
    ? `Skip your ${monster.name} task`
    : decision.bossVariant
      ? `Try ${decision.bossVariant.name} on task`
      : `Finish your ${monster.name} task`;
  const score = decision.verdict === "boss-variant" ? 98 : decision.verdict === "skip" ? 90 : slayer.taskRemaining >= 10 ? 96 : 72;
  const completionTarget = decision.verdict === "skip" ? undefined : {
    kind: "slayer_task_finished" as const,
    taskId: slayer.currentTaskId,
    taskName: monster.name,
    startingRemaining: slayer.taskRemaining
  };
  const bossLink = decision.bossVariant
    ? `/dps?boss=${encodeURIComponent(decision.bossVariant.slug)}&from=slayer-task${context.displayName ? `&rsn=${encodeURIComponent(context.displayName)}` : ""}`
    : null;
  const routeTags: RecommendationRouteTag[] = ["slayer", "unlock"];
  if (decision.method === "boss") routeTags.push("pvm", "fun");
  else if (decision.method === "afk") routeTags.push("afk");
  else routeTags.push("pvm");

  return [{
    id: `slayer:current-task:${slug}`,
    kind: "slayer",
    title,
    why: decision.why,
    payoff: `~${Math.round(taskXp / 100) / 10}k Slayer XP remaining · streak ${slayer.streak.toLocaleString()}.`,
    decisionReason: `RuneLite last confirmed ${taskLeftLabel}. ${decision.why}`,
    score,
    link: bossLink ?? (context.displayName ? slayerUrlForSyncedRsn(context.displayName) : "/slayer"),
    iconItemId: decision.bossVariant?.viability.boss.iconItemId ?? 11864,
    completionTarget,
    routeTags,
    gearConfidence: decision.bankUsed ? "confirmed" : "unknown",
    slayerDecision: decision,
    sessionProfile: {
      intensity: decision.method === "boss" ? "high" : decision.method === "afk" ? "low" : "moderate",
      attention: decision.method === "boss" ? "focused" : decision.method === "afk" ? "afk" : "active",
      idleWindowSeconds: decision.method === "afk" ? 20 : 0,
      setupConfidence: decision.bankUsed ? "verified" : "unknown",
      expectedProfit: decision.bossVariant ? "positive" : "unknown",
      profitEvidence: decision.bossVariant ? "account" : "none"
    },
    quality: {
      accountFit: 0.99,
      actionability: 0.96,
      stopPoint: 0.94,
      gearConfidence: decision.bankUsed ? 0.94 : 0.48,
      unlockValue: 0.78,
      fun: 0.74,
      friction: 0.14
    },
    needs: [
      ...decision.inventory.filter((item) => item.owned).slice(0, 3).map((item) => item.itemName ?? item.label),
      ...decision.missing.slice(0, 2).map((item) => `Missing: ${item}`)
    ],
    details: `${decision.location}. ${decision.pointsConsequence}${decision.avoid ? ` ${decision.avoid}` : ""}`,
    planSeed: {
      timebox: slayer.taskRemaining >= 80 ? "45-90 min" : slayer.taskRemaining >= 25 ? "25-45 min" : "10-20 min",
      prep: decision.firstStep,
      steps: [
        decision.firstStep,
        decision.inventory.length > 0
          ? `Bring ${decision.inventory.slice(0, 3).map((item) => item.itemName ?? item.label).join(", ")}.`
          : `Build one short ${decision.methodLabel.toLowerCase()} setup.`,
        decision.stopPoint
      ]
    }
  }];
}


// Bank-hygiene nudges, only when a bank was pasted.
function bankRecs(bank: CompletionItem[]): Recommendation[] {
  if (bank.length === 0) return [];
  return [{
    id: "bank:organize",
    kind: "bank",
    title: "Tidy your bank",
    why: `${bank.length} items — a clean, tabbed bank makes every trip faster.`,
    payoff: "Auto-sorted into use-case tabs you can paste back into RuneLite.",
    decisionReason: "Bank cleanup only wins when it reduces friction for every later trip.",
    score: 30,
    link: "/bank?mode=tidy",
    iconItemId: 20594,
    planSeed: {
      timebox: "10-20 min",
      prep: `You have ${bank.length} recognized bank items; clean tabs reduce friction on every later trip.`,
      steps: [
        "Pick the bank layout that matches how you play.",
        "Press Smart tidy, then check Teleports, PvM Gear and Supplies first.",
        "Copy the cleaned tabs into RuneLite when the layout feels usable."
      ]
    }
  }];
}

// When we only have a bank and no Hiscores, be honest about the gap: the
// best advice we can give is "let us read your stats too." Surfaces as the
// headline for the fresh-account / no-RSN path so the user doesn't think
// "Tidy your bank" is the best we can do.
function noHiscoresNudge(): Recommendation {
  return {
    id: "meta:add-rsn",
    kind: "goal",
    title: "Add your OSRS name for a real plan",
    why: "We can only see your bank. Your Hiscores add skills, combat, KC and quest gates.",
    payoff: "Free, no plugin, no account. Just your RSN.",
    decisionReason: "Bank added. Your OSRS name turns this into a real session plan.",
    score: 95,
    link: undefined,
    planSeed: {
      timebox: "2 min",
      prep: "Bank added. Stats make the next move useful.",
      steps: [
        "Enter your OSRS name and keep this bank attached.",
        "Use the first plan it gives you, then add bank or RuneLite only if the pick looks off.",
        "Run Scapestack Sync later if your plan suggests quests, diary tiers, collection-log slots or Slayer tasks you already finished."
      ]
    }
  };
}

function starterQuestRecs(hasHiscores: boolean, bank: CompletionItem[]): Recommendation[] {
  if (hasHiscores || bank.length === 0 || bank.length > 20) return [];
  return [
    {
      id: "quest:Cook's Assistant",
      kind: "quest",
      title: "Cook's Assistant",
      why: "Fast starter quest · no combat",
      payoff: "Quick quest point and unlocks the habit of quest-first progression.",
      decisionReason: "This is a quick first quest that moves the account without gear checks.",
      score: 42,
      link: `/quests/${questSlug("Cook's Assistant")}`,
      completionTarget: { kind: "quest_completed", quest: "Cook's Assistant" },
      planSeed: {
        timebox: "5-10 min",
        prep: "Grab an egg, bucket of milk and pot of flour before entering Lumbridge Castle.",
        steps: [
          "Talk to the cook in Lumbridge Castle kitchen.",
          "Hand in the three ingredients in one trip.",
          "Check your plan again after a few starter quests so Hiscores-based advice has real account signal."
        ]
      }
    },
    {
      id: "quest:Sheep Shearer",
      kind: "quest",
      title: "Sheep Shearer",
      why: "Fast starter quest · no combat",
      payoff: "Easy quest point and basic skilling loop near Lumbridge.",
      decisionReason: "A fast skilling loop is useful when the account has almost no visible stats yet.",
      score: 41,
      link: `/quests/${questSlug("Sheep Shearer")}`,
      completionTarget: { kind: "quest_completed", quest: "Sheep Shearer" },
      planSeed: {
        timebox: "5-10 min",
        prep: "Bring shears or buy them from a general store before going to Fred's farm.",
        steps: [
          "Talk to Fred the Farmer north-west of Lumbridge.",
          "Shear sheep, spin the wool, then turn in the balls of wool.",
          "Use this as a quick quest-count bump before longer routes."
        ]
      }
    },
    {
      id: "quest:Romeo & Juliet",
      kind: "quest",
      title: "Romeo & Juliet",
      why: "Fast starter quest · no combat",
      payoff: "Five quest points very early, useful for unlocking broader quest chains.",
      decisionReason: "Five quick quest points is a better starter move than a vague grind.",
      score: 40,
      link: `/quests/${questSlug("Romeo & Juliet")}`,
      completionTarget: { kind: "quest_completed", quest: "Romeo & Juliet" },
      planSeed: {
        timebox: "10-15 min",
        prep: "Start in Varrock and bank a cadava berry to avoid extra walking.",
        steps: [
          "Talk to Romeo in Varrock square and route through Juliet/Father Lawrence.",
          "Pick or bring the cadava berry before visiting the Apothecary.",
          "Finish the quest, then add your RSN so Scapestack can use Hiscores instead of a starter-account default."
        ]
      }
    }
  ];
}

function accountRouteRecs(input: {
  skills: HiscoreSkill[];
  bank: CompletionItem[];
  questPoints: number | null;
  accountStage: AccountStage;
  accountMeta?: AccountMeta | null;
  completedQuestNames?: Set<string>;
}): Recommendation[] {
  const { skills, bank, questPoints, accountStage, accountMeta, completedQuestNames } = input;
  if (skills.length === 0) return [];

  const recs: Recommendation[] = [];
  const combatLevel = computeCombatLevel(skills);
  const totalLevel = computeTotalLevel(skills);
  const iron = isIronAccount(accountMeta);
  const prayer = lvl(skills, "Prayer");
  const herblore = lvl(skills, "Herblore");
  const agility = lvl(skills, "Agility");
  const farming = lvl(skills, "Farming");
  const hunter = lvl(skills, "Hunter");
  const crafting = lvl(skills, "Crafting");
  const ranged = lvl(skills, "Ranged");
  const slayer = lvl(skills, "Slayer");

  if (
    herblore <= 3
    && (questPoints === null || questPoints < QUEST_CAPE_QP_THRESHOLD)
    && !completedQuest(completedQuestNames, ["Druidic Ritual"])
  ) {
    recs.push({
      id: "quest:Druidic Ritual",
      kind: "quest",
      title: "Unlock Herblore",
      why: "Druidic Ritual opens potions, quest gates and ironman supply routes.",
      payoff: "Herblore unlocks quest chains, diary steps and better supplies.",
      decisionReason: "Herblore is still locked, so this tiny quest unlocks more account routes than random skilling.",
      score: accountStage.id === "new-account" || iron ? 76 : 66,
      link: `/quests/${questSlug("Druidic Ritual")}`,
      iconItemId: 255,
      completionTarget: { kind: "quest_completed", quest: "Druidic Ritual" },
      routeTags: ["beginner", "unlock", "iron", "returning"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.92,
        actionability: 0.96,
        stopPoint: 0.95,
        gearConfidence: 1,
        unlockValue: 0.96,
        fun: 0.5,
        friction: 0.08
      },
      planSeed: {
        timebox: "10-20 min",
        prep: "Bank raw beef, raw rat meat, raw bear meat and raw chicken before walking to Taverley.",
        steps: [
          "Talk to Kaqemeex north of Taverley, then Sanfew upstairs in the Herblore shop.",
          "Dip the four meats in the Cauldron of Thunder and hand them in.",
          "Finish after Herblore unlocks; check your plan again because potions and quest chains now open."
        ]
      }
    });
  }

  if (combatLevel >= 35 && prayer >= 37 && prayer < 43) {
    const gap = 43 - prayer;
    const prayerState = skills.find((entry) => entry.name === "Prayer");
    const prayerRoute = prayerState
      ? buildSkillRoute({
          skill: prayerState,
          targetLevel: 43,
          bank: bank.length > 0 ? bank : undefined,
          accountType: accountMeta?.accountType ?? null,
          skills,
          unlock: "protection prayers"
        })
      : null;
    recs.push({
      id: "skill:Prayer:43-protection",
      kind: "skill",
      title: "Unlock protection prayers",
      why: `Prayer ${prayer} -> 43 turns a lot of quests and boss learning from scary to manageable.`,
      payoff: "Protect from Melee, Missiles and Magic.",
      decisionReason: `You are only ${gap} Prayer level${gap === 1 ? "" : "s"} from protection prayers, one of the cleanest account unlocks in OSRS.`,
      score: 80 - gap * 3,
      link: "/goals",
      iconItemId: 2412,
      needs: prayerRoute ? skillRouteNeeds(prayerRoute) : undefined,
      completionTarget: { kind: "skill_level_at_least", skill: "Prayer", target: 43 },
      routeTags: ["beginner", "returning", "unlock", "pvm"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.92,
        actionability: 0.86,
        stopPoint: 0.95,
        gearConfidence: 1,
        unlockValue: 0.98,
        fun: 0.58,
        friction: 0.16
      },
      planSeed: prayerRoute ? skillRoutePlanSeed(prayerRoute) : {
        timebox: gap <= 2 ? "20-45 min" : "45-90 min",
        prep: `Prayer ${prayer} -> 43. Buy only enough bones/ensouled heads for the gap.`,
        steps: [
          "Use the fastest altar or ensouled-head method you can afford.",
          "Stop exactly at 43 Prayer; protection prayers are the unlock, not a random XP grind.",
          "Check your plan again because quest, diary and PvM routes change immediately."
        ]
      }
    });
  }

  if (
    (questPoints === null || questPoints < QUEST_CAPE_QP_THRESHOLD)
    && ranged >= 30
    && prayer >= 31
    && crafting >= 18
    && slayer >= 18
    && !completedQuest(completedQuestNames, ["Animal Magnetism"])
  ) {
    recs.push({
      id: "quest:Animal Magnetism",
      kind: "quest",
      title: "Get Ava's device",
      why: "Your stats fit Animal Magnetism; Ava's saves ammo on every ranged trip.",
      payoff: "Ava's accumulator and a cleaner ranged setup forever.",
      decisionReason: "This is a small quest with a permanent gear payoff, so it beats another unfocused ranged grind.",
      score: 60,
      link: `/quests/${questSlug("Animal Magnetism")}`,
      iconItemId: 10499,
      completionTarget: { kind: "quest_completed", quest: "Animal Magnetism" },
      routeTags: ["unlock", "pvm", "returning", "iron"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.86,
        actionability: 0.78,
        stopPoint: 0.84,
        gearConfidence: 0.96,
        unlockValue: 0.92,
        fun: 0.58,
        friction: 0.28
      },
      planSeed: {
        timebox: "45-75 min",
        prep: "Check the short prereqs, then bank teleports to Draynor, Port Phasmatys and the Slayer tower area.",
        steps: [
          "Start with Ava in Draynor Manor and keep the quest guide open for item hand-ins.",
          "Finish the undead chicken/magnet pieces before doing extra training.",
          "Equip Ava's and check your plan again; ranged bosses and Slayer tasks become cleaner."
        ]
      }
    });
  }

  if (
    totalLevel >= 450
    && totalLevel < 2100
    && agility >= 10
    && agility < 60
  ) {
    const target = agility < 40 ? 40 : 60;
    const agilityState = skills.find((entry) => entry.name === "Agility");
    const agilityRoute = agilityState
      ? buildSkillRoute({
          skill: agilityState,
          targetLevel: target,
          bank: bank.length > 0 ? bank : undefined,
          accountType: accountMeta?.accountType ?? null,
          skills,
          unlock: target === 40 ? "the next Graceful route" : "a stronger rooftop route"
        })
      : null;
    recs.push({
      id: "skill:Agility:graceful-route",
      kind: "skill",
      title: target === 40 ? "Start Graceful" : "Finish Graceful",
      why: `Agility ${agility}. Rooftops make questing, clues and herb runs less painful.`,
      payoff: "Marks of grace, run energy and a smoother account.",
      decisionReason: "Run energy is account-wide friction; Graceful makes almost every later route feel better.",
      score: target === 40 ? 56 : 60,
      link: "/goals",
      iconItemId: 11850,
      needs: agilityRoute ? skillRouteNeeds(agilityRoute) : undefined,
      routeTags: ["skiller", "returning", "unlock"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.82,
        actionability: 0.86,
        stopPoint: target === 40 ? 0.78 : 0.72,
        gearConfidence: 1,
        unlockValue: 0.78,
        fun: 0.48,
        friction: 0.24
      },
      planSeed: agilityRoute ? skillRoutePlanSeed(agilityRoute) : {
        timebox: "45-90 min",
        prep: `Run rooftops toward Agility ${target}; marks of grace are the real reward.`,
        steps: [
          "Pick the highest rooftop course you can run comfortably.",
          "Do one clean mark/level block, not an endless agility session.",
          "Finish after the level target or Graceful piece lands, then check your plan again."
        ]
      }
    });
  }

  if (totalLevel >= 650 && (questPoints === null || questPoints < QUEST_CAPE_QP_THRESHOLD) && !completedQuest(completedQuestNames, [
    "Fairytale II - Cure a Queen",
    "Fairy Tale II - Cure a Queen"
  ])) {
    recs.push({
      id: "quest:fairy-rings-route",
      kind: "quest",
      title: "Unlock fairy rings",
      why: "Fairy rings make quests, clues, herb runs and Slayer routes massively shorter.",
      payoff: "Travel upgrade: less walking, faster trips, better daily loops.",
      decisionReason: "Travel time is hidden bankstanding; fairy rings remove friction from almost every account route.",
      score: accountStage.id === "returning" || iron ? 62 : 58,
      link: `/quests/${questSlug("Fairytale II - Cure a Queen")}`,
      iconItemId: 772,
      routeTags: ["unlock", "returning", "iron"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.86,
        actionability: 0.7,
        stopPoint: 0.72,
        gearConfidence: 0.94,
        unlockValue: 0.96,
        fun: 0.62,
        friction: 0.36
      },
      planSeed: {
        timebox: "1-2 hr",
        prep: "Check Fairytale I/II prereqs first. You only need partial Fairytale II progress for ring access.",
        steps: [
          "Clear Fairytale I if needed, then start Fairytale II until fairy rings unlock.",
          "Set a fairy ring near your bank route and test one herb/clue/Slayer trip.",
          "Stop at fairy ring access; full quest completion can be a later unlock session."
        ]
      }
    });
  }

  const shouldSuggestSupplyLoop = farming >= 32 && hunter >= 5;
  const supplyLoopScore = accountStage.id === "maxed-grinder" ? 20 : 60;
  // Herb patches are open to everyone; birdhouses need Fossil Island, which
  // means Bone Voyage. Rather than dropping the whole loop when we can prove
  // the quest is missing, we fall back to the half that still works.
  const birdhouseAccess = evaluateAccess({ quests: ["Bone Voyage"] }, {
    completedQuestNames,
    skills
  });
  const birdhousesReachable = birdhouseAccess.state !== "locked";
  const loopTitle = birdhousesReachable ? "Run herbs + birdhouses" : "Run a herb round";
  const loopAccessLine = accessNeedsLine(birdhouseAccess);
  if (shouldSuggestSupplyLoop) {
    if (iron) {
      recs.push({
        id: "skill:iron-herb-birdhouse-loop",
        kind: "skill",
        title: loopTitle,
        needs: loopAccessLine ? [loopAccessLine] : undefined,
        why: birdhousesReachable
          ? "Ironman supplies come from loops: herbs, nests, seeds and passive Hunter XP."
          : "Ironman supplies come from loops: herbs, seeds and steady Farming progress.",
        payoff: "Prayer pots, brews later, tree seeds and easy daily progress.",
        decisionReason: "Your Farming and Hunter already support the supply loop that keeps ironman progress moving.",
        score: supplyLoopScore,
        link: "/goals",
        iconItemId: 10092,
        routeTags: ["iron", "afk", "rebuild", "skiller"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.9,
          actionability: 0.9,
          stopPoint: 0.95,
          gearConfidence: 1,
          unlockValue: 0.82,
          fun: 0.62,
          friction: 0.14
        },
        planSeed: {
          timebox: "10-15 min",
          prep: birdhousesReachable
            ? "Bring seeds, compost, logs, clockworks and Fossil Island teleports."
            : "Bring seeds and compost for the patch round.",
          steps: [
            birdhousesReachable
              ? "Do a herb run first, then reset all four birdhouses."
              : "Clear and replant every herb patch you can reach.",
            "Bank seeds/nests immediately so the next loop is ready.",
            "Stop after the loop; use the downtime for the main plan."
          ]
        }
      });
    } else {
      recs.push({
        id: "money:rebuild-herb-birdhouse-loop",
        kind: "money",
        title: loopTitle,
        needs: loopAccessLine ? [loopAccessLine] : undefined,
        why: birdhousesReachable
          ? "Fast GP and passive Hunter XP without committing to a grind."
          : "Fast GP without committing to a grind.",
        payoff: "A 10-minute loop can fund teleports, supplies and small upgrades.",
        decisionReason: "This is a practical rebuild loop: low setup, clear stop point, and useful even when you are unsure what to do.",
        score: accountStage.id === "maxed-grinder" ? 20 : 56,
        link: undefined,
        iconItemId: 10092,
        routeTags: ["gp", "afk", "rebuild", "returning"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.86,
          actionability: 0.92,
          stopPoint: 0.96,
          gearConfidence: 1,
          unlockValue: 0.7,
          fun: 0.6,
          friction: 0.12
        },
        planSeed: {
          timebox: "10-15 min",
          prep: birdhousesReachable
            ? "Bring seeds, ultracompost, birdhouse logs, clockworks and Fossil Island access."
            : "Bring seeds and ultracompost for the patch round.",
          steps: [
            birdhousesReachable
              ? "Clear herb patches, replant, then reset all four birdhouses."
              : "Clear every herb patch you can reach, then replant.",
            "Sell herbs/nests only after checking whether an upgrade or quest supply stack needs them.",
            "Stop after one loop; this should support the main plan, not replace it."
          ]
        }
      });
    }
  }

  if (totalLevel >= 1700 && totalLevel < ROUTABLE_SKILLS.length * 99) {
    const near99 = skills
      .filter((skill) => skill.name !== "Overall" && skill.level >= 90 && skill.level < 99)
      .sort((a, b) => b.level - a.level)[0];
    if (near99) {
      const route = buildSkillRoute({
        skill: near99,
        targetLevel: 99,
        bank: bank.length > 0 ? bank : undefined,
        accountType: accountMeta?.accountType ?? null,
        skills,
        unlock: `${near99.name} cape`
      });
      recs.push({
        id: `milestone:maxing-lane:${near99.name}`,
        kind: "milestone",
        title: `Pick a maxing lane: ${near99.name}`,
        why: route
          ? `${near99.name} ${near99.level} · ${route.xpRemaining.toLocaleString()} XP left for the cape.`
          : `${near99.name} ${near99.level}. Close enough to turn spare sessions into cape progress.`,
        payoff: "A focused maxing lane stops your plan from feeling like random chores.",
        decisionReason: route?.recommended
          ? `${route.recommended.method.name} is the cleanest visible ${near99.name} lane for this account.`
          : `${near99.name} is your cleanest visible maxing lane, so it is a better long arc than bouncing between unrelated grinds.`,
        score: near99.level >= 95 ? 73 : 64,
        link: "/goals",
        iconItemId: skillCapeId(near99.name),
        needs: route ? skillRouteNeeds(route) : undefined,
        completionTarget: { kind: "skill_level_at_least", skill: near99.name, target: 99 },
        routeTags: ["maxing", "skiller"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.82,
          actionability: 0.72,
          stopPoint: 0.66,
          gearConfidence: 1,
          unlockValue: 0.8,
          fun: 0.56,
          friction: near99.level >= 95 ? 0.24 : 0.42
        },
        planSeed: route ? skillRoutePlanSeed(route) : {
          timebox: "1-2 sessions",
          prep: `Choose one ${near99.name} method and stop at a level, XP chunk or cape prep milestone.`,
          steps: [
            `Train ${near99.name} only for this block; do not mix in random chores mid-session.`,
            "Use AFK if you are low-energy, or a faster method if you are focused.",
            "Check your plan again after the level; maxing routes should change as soon as the closest lane changes."
          ]
        }
      });
    }
  }

  return recs.sort((a, b) => b.score - a.score).slice(0, 6);
}
const VISIBLE_RECOMMENDATION_COUNT = 12;
const VISIBLE_KIND_LIMITS: Partial<Record<RecKind, number>> = {
  diary: 1,
  money: 2,
  skill: 2,
  boss: 2,
  kc: 2,
  goal: 2,
  quest: 2,
  slayer: 1,
  bank: 1,
  minigame: 1
};

function prioritizeVisibleRecommendations(sortedRecs: Recommendation[]): Recommendation[] {
  if (sortedRecs.length <= VISIBLE_RECOMMENDATION_COUNT) return sortedRecs;

  const selected: Recommendation[] = [];
  const selectedIds = new Set<string>();
  const kindCounts = new Map<RecKind, number>();
  const add = (rec: Recommendation): void => {
    selected.push(rec);
    selectedIds.add(rec.id);
    kindCounts.set(rec.kind, (kindCounts.get(rec.kind) ?? 0) + 1);
  };

  add(sortedRecs[0]);
  for (const rec of sortedRecs.slice(1)) {
    if (selected.length >= VISIBLE_RECOMMENDATION_COUNT) break;
    const limit = VISIBLE_KIND_LIMITS[rec.kind] ?? 2;
    if ((kindCounts.get(rec.kind) ?? 0) >= limit) continue;
    add(rec);
  }

  for (const rec of sortedRecs) {
    if (selected.length >= VISIBLE_RECOMMENDATION_COUNT) break;
    if (!selectedIds.has(rec.id)) add(rec);
  }

  return [
    ...selected,
    ...sortedRecs.filter((rec) => !selectedIds.has(rec.id))
  ];
}

function mergeCompletionItems(
  bank: CompletionItem[],
  earnedItems: CompletionItem[]
): CompletionItem[] {
  const merged = [...bank];
  const seen = new Set(merged.map((item) => item.id));
  for (const item of earnedItems) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

function accountMetaFromScapestackSync(sync: NextUpInput["scapestackSync"]): AccountMeta | null {
  if (!sync) return null;
  return {
    displayName: sync.displayName ?? "Scapestack Sync",
    accountType: scapestackAccountTypeToPlannerType(normalizeScapestackAccountType(sync.accountType)),
    ehp: 0,
    ehb: 0,
    lastChangedAt: null
  };
}

function compactXp(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

function topSyncSkill(summary: SyncDeltaSummary | null | undefined): SyncDeltaSummary["skills"][number] | null {
  if (!summary?.skills.length) return null;
  return [...summary.skills].sort((a, b) => b.xpGained - a.xpGained)[0] ?? null;
}

function buildReturnPlan(input: {
  headline: Recommendation | null;
  nextBestActions: NextBestAction[];
  summary: SyncDeltaSummary | null | undefined;
  hasBank: boolean;
  hasPluginSync: boolean;
  pluginSyncState: "live" | "stale" | "outdated" | null;
}): ReturnPlan {
  const { headline, nextBestActions, summary, hasBank, hasPluginSync, pluginSyncState } = input;
  const nextTitle = headline?.title || nextBestActions[0]?.title || "the next trip";
  const xpGained = summary?.skills.reduce((sum, skill) => sum + Math.max(0, skill.xpGained), 0) ?? 0;
  const topSkill = topSyncSkill(summary);
  const hasFinishedSteps = Boolean(summary && (summary.questsCompleted.length > 0 || summary.diariesCompleted.length > 0));
  const hasClog = Boolean(summary && (summary.collectionLogItems.length > 0 || summary.collectionLogItemIds.length > 0));
  const hasBankDelta = Boolean(summary?.bank?.currentItemCount);
  const hasProgress = Boolean(summary && (hasFinishedSteps || hasClog || xpGained > 0 || hasBankDelta || summary.accountType.changed));

  let title = "Come back after the stop point";
  let lead = `${nextTitle} is the current answer. Finish the stop point, then let the next route move.`;
  if (hasFinishedSteps) {
    title = "Finished steps are gone next time";
    lead = `${nextTitle} moved up because quests or diary tiers stopped taking a slot.`;
  } else if (hasClog) {
    title = "New clog progress changes the next route";
    lead = `${nextTitle} is checked after your latest collection-log progress.`;
  } else if (xpGained > 0 && topSkill) {
    title = `${compactXp(xpGained)} XP since last scan`;
    lead = `${topSkill.name} moved, so ${nextTitle} is checked against the latest levels.`;
  } else if (hasBankDelta) {
    title = "Your bank can change the next trip";
    lead = `${nextTitle} is using the bank RuneLite just sent.`;
  } else if (hasPluginSync) {
    title = "Sync after progress";
    lead = "RuneLite can remove finished quests, diary steps, clog slots and Slayer mistakes from the next pick.";
  } else if (hasBank) {
    title = "Refresh bank only when it matters";
    lead = "If gear, supplies or GP changed, update the bank before the next trip.";
  }

  const sinceLastTrip: string[] = [];
  if (topSkill && topSkill.xpGained > 0) {
    const level = topSkill.currentLevel > topSkill.previousLevel
      ? ` ${topSkill.previousLevel}->${topSkill.currentLevel}`
      : "";
    sinceLastTrip.push(`${topSkill.name}${level}: +${compactXp(topSkill.xpGained)} XP`);
  }
  if (summary?.questsCompleted.length) {
    sinceLastTrip.push(`${summary.questsCompleted[0]} finished`);
  }
  if (summary?.diariesCompleted.length) {
    const diary = summary.diariesCompleted[0];
    sinceLastTrip.push(`${diary.region} ${diary.tier} finished`);
  }
  if (summary?.collectionLogItems.length) {
    sinceLastTrip.push(`${summary.collectionLogItems[0].name} added`);
  } else if (summary?.collectionLogItemIds.length) {
    sinceLastTrip.push(`${summary.collectionLogItemIds.length} clog slot${summary.collectionLogItemIds.length === 1 ? "" : "s"} added`);
  }
  if (summary?.bank?.currentItemCount) {
    sinceLastTrip.push(`Bank: ${summary.bank.currentItemCount.toLocaleString()} stacks`);
  }
  if (sinceLastTrip.length === 0) {
    sinceLastTrip.push(headline?.actionPlan?.timebox ? `Current trip: ${headline.actionPlan.timebox}` : "Do the stop point first");
    sinceLastTrip.push(`Next pick: ${nextTitle}`);
  }

  const checkBack = pluginSyncState === "live"
    ? "Press Sync in RuneLite after the stop point."
    : pluginSyncState === "stale" || pluginSyncState === "outdated"
      ? "Refresh RuneLite before a longer grind."
      : hasBank
        ? "Update bank if gear, supplies or GP changed."
        : "Mark done or pick another route after the stop point.";
  const nextLogin = pluginSyncState === "live"
    ? "Scapestack will skip finished stuff and pick the next clean block."
    : hasBank
      ? "The next plan can use fresh gear and supplies."
      : "Your skips and done picks still shape the next route.";

  return {
    title,
    lead,
    sinceLastTrip: sinceLastTrip.slice(0, 4),
    checkBack,
    nextLogin,
    hasProgress
  };
}

// ── Engine ──────────────────────────────────────────────────────────────────

export async function computeNextUp(input: NextUpInput): Promise<NextUpResult> {
  const skills = input.skills ?? [];
  const bank = input.bank ?? [];
  const goalItems = mergeCompletionItems(bank, input.earnedItems ?? []);
  // null = unknown, which is the normal case: the Hiscores do not publish
  // quest points. Downstream must not read that as zero.
  const qp = input.questPoints ?? null;
  const hasHiscores = skills.length > 0;
  const hasBank = bank.length > 0;
  const accountMode = resolveAccountMode({
    scapestackAccountType: input.scapestackSync?.accountType,
    plannerAccountType: input.accountMeta?.accountType ?? null
  });
  const accountMeta = accountMode.type
    ? {
        ...(input.accountMeta ?? accountMetaFromScapestackSync(input.scapestackSync) ?? {
          displayName: input.scapestackSync?.displayName ?? "Unknown player",
          ehp: 0,
          ehb: 0,
          lastChangedAt: null
        }),
        accountType: accountMode.type
      }
    : null;

  const combatLevel = hasHiscores ? computeCombatLevel(skills) : null;
  const totalLevel = hasHiscores ? computeTotalLevel(skills) : null;

  // Goal completion needs *something* to check against. Hiscores alone can
  // satisfy skill-cape goals (via the virtual-cape synthesis in goals.ts);
  // a bank satisfies item goals. We feed whichever we have.
  const completions = (goalItems.length > 0 || hasHiscores)
    ? checkCompletion(goalItems)
    : [];
  const goalPercent = completions.length > 0
    ? overallStats(completions).percent
    : null;

  // Quest + diary + drop-rate data ship as static JSON files — best-effort,
  // the engine still works if a file is missing (the build scripts generate
  // them). All three loads are kicked off in parallel.
  const shouldLoadQuests = hasHiscores || hasBank || Boolean(input.scapestackSync);
  const [quests, diaries, dropTables] = await Promise.all([
    shouldLoadQuests ? getQuests().catch(() => new Map()) : Promise.resolve(new Map<string, QuestRecord>()),
    hasHiscores ? getDiaries().catch(() => new Map()) : Promise.resolve(new Map()),
    hasHiscores ? getDropRates().catch(() => new Map()) : Promise.resolve(new Map())
  ]);

  // Collection-log owned-item set (cl.net). Rebuild from the input
  // array — the action layer flattens it to a list because Set isn't
  // structured-clone-safe across the server/client boundary.
  const clOwned = input.collectionLogOwnedItemIds
    ? new Set(input.collectionLogOwnedItemIds)
    : undefined;

  const completedQuestNames = input.scapestackSync?.questsCompleted
    ? new Set(input.scapestackSync.questsCompleted.map((q) => q.toLowerCase()))
    : undefined;
  const completedDiaryTierKeys = input.scapestackSync?.diariesCompleted
    ? new Set(input.scapestackSync.diariesCompleted.map((d) => diaryTierKey(d.region, d.tier)))
    : undefined;

  // Plugin KC can be fresher than Hiscores. Keep the highest observed value
  // so a delayed public lookup cannot make established progress disappear.
  const mergedBossKc: Record<string, number> = { ...(input.scapestackSync?.bossKc ?? {}) };
  for (const [boss, kc] of Object.entries(input.bossKc ?? {})) {
    mergedBossKc[boss] = Math.max(mergedBossKc[boss] ?? 0, kc);
  }
  if (input.womBossKills) {
    // WOM uses snake_case names; the engine + drop-tables use the Wiki
    // form. We seed the merged map with WOM data under the SAME keys
    // we use elsewhere (drop-rates-db's `hiscoresName`). The path-
    // progress bossesPath already does this merge for its own consumer.
    // Here we trust input.bossKc as the canonical source; WOM keys are
    // not directly mappable without a lookup table, so we leave merging
    // to the path-progress layer that has both.
  }

  const pluginSyncState = input.syncedSources?.scapestack
    ? pluginSyncHealth({
        pluginVersion: input.syncedSources.scapestack.pluginVersion,
        syncedAt: input.syncedSources.scapestack.syncedAt
      })
    : input.scapestackSync
      ? "live"
      : null;
  const hasPluginSync = Boolean(input.scapestackSync);
  const accountStage = detectAccountStage({
    skills,
    combatLevel,
    totalLevel,
    questPoints: qp,
    bossKc: mergedBossKc,
    accountMeta,
    hasBankContext: hasBank,
    hasPluginSync: pluginSyncState === "live",
    // Deliberately not gated on pluginSyncState. A snapshot older than 24 hours
    // reads "stale", but it is still proof the client was open then — and that
    // has to outrank a WOM lastChangedAt that may simply never have been
    // refreshed. Only the returning check reads this.
    lastActiveAt: latestActivity(
      accountMeta?.lastChangedAt,
      input.syncedSources?.scapestack?.syncedAt
    )
  });

  // What the player can actually reach. Quest and diary sets are undefined
  // without an exact source, which the evaluator reads as "unknown" — it
  // hedges the copy rather than hiding content it cannot verify.
  const accessContext: AccessContext = {
    completedQuestNames,
    completedDiaryTierKeys,
    skills
  };
  // Materialised once. Every consumer may iterate it as often as it likes.
  const knownQuestNames = new Set(quests.keys());

  const rawRecs = applyBossViability([
    ...goalRecs(completions),
    ...(combatLevel !== null ? bossRecs(combatLevel, bank, skills, mergedBossKc, accountMeta?.accountType ?? null, accessContext) : []),
    ...slayerTaskRecs(input.scapestackSync?.slayer, {
      displayName: input.scapestackSync?.displayName ?? accountMeta?.displayName,
      bank,
      accountType: accountMeta?.accountType ?? null,
      combatLevel,
      slayerLevel: lvl(skills, "Slayer"),
      syncHealth: pluginSyncState ?? "unknown"
    }),
    ...questRecs(
      quests,
      skills,
      qp,
      completedQuestNames,
      bank,
      accountMeta?.accountType ?? null,
      input.scapestackSync?.questsCompleted ? "runelite" : completedQuestNames ? "tracker" : undefined
    ),
    ...activeBossKcRecs(mergedBossKc, bank, skills, accountMeta?.accountType ?? null),
    ...diaryRecs(diaries, skills, {
      bank,
      accountType: accountMeta?.accountType ?? null,
      completedQuestNames,
      completedDiaryTiers: completedDiaryTierKeys,
      // A Map iterator, which was the bug: diary-requirements spreads it into
      // a Set per tier, so the first tier drained it and the other 47 got an
      // empty set and no quest gate at all — 6 of 48 tiers gated instead of 37.
      knownQuestNames: knownQuestNames
    }),
    ...kcRecs(dropTables, mergedBossKc, bank, clOwned),
    ...minigameRecs(skills, accessContext),
    ...moneyRecs(skills, accountMeta, accessContext),
    ...skillRecs(skills, bank, accountMeta?.accountType ?? null),
    ...accountRouteRecs({
      skills,
      bank,
      questPoints: qp,
      accountStage,
      accountMeta,
      completedQuestNames
    }),
    ...starterQuestRecs(hasHiscores, bank),
    ...bankRecs(bank),
    // No-Hiscores nudge: when the player only gave a bank, lead with "add
    // your RSN" rather than letting "Tidy your bank" become the headline.
    ...(!hasHiscores && hasBank ? [noHiscoresNudge()] : [])
  ], bank);
  const sortedRecs = rankRecommendations(rawRecs, {
    hasBank,
    accountStage,
    accountMeta
  });
  const recs: Recommendation[] = withActionPlans(prioritizeVisibleRecommendations(sortedRecs), {
    hasHiscores,
    hasBank,
    hasPluginSync,
    hasExactPluginSync: pluginSyncState === "live"
  });

  const basis: NextUpResult["summary"]["basis"] =
    hasHiscores && hasBank ? "full"
    : hasHiscores ? "hiscores-only"
    : hasBank ? "bank-only"
    : "none";

  // Path-to-Max progress — drives the new path-card UI. Cheap to compute
  // (no extra disk reads; quests/diaries are already loaded above) and
  // always populated even when data is sparse. WOM + Temple + cl.net
  // enrichments are all optional; when missing we fall back to
  // Hiscores-only behaviour.
  const pathProgress: PathOverview = computePathProgress({
    skills,
    quests,
    diaries,
    bossKc: mergedBossKc,
    questPoints: qp,
    womBossKills: input.womBossKills,
    accountMeta,
    collectionLogOwnedItemIds: clOwned,
    scapestackSync: input.scapestackSync ? {
      questsCompleted: input.scapestackSync.questsCompleted
        ? new Set(input.scapestackSync.questsCompleted.map((q) => q.toLowerCase())) : undefined,
      diariesCompleted: input.scapestackSync.diariesCompleted
        ? new Set(input.scapestackSync.diariesCompleted.map((d) => `${d.region}:${d.tier}`)) : undefined,
      collectionLogItemIds: input.scapestackSync.collectionLogItemIds
        ? new Set(input.scapestackSync.collectionLogItemIds) : undefined
    } : undefined,
    syncedSources: input.syncedSources
  });

  // Readiness chips — top 6 sets die dichtsbij voltooien zijn (oftewel:
  // "je hebt al de meeste pieces, deze paar items missen nog"). Lege
  // array als geen bank gepasted is — chips renderen niet.
  const readiness = completions.length > 0
    ? closestToComplete(completions, 6)
    : [];

  // Hours-to-max — alleen wanneer Hiscores geladen zijn (vereist xp
  // per skill). Lege summary als skills leeg.
  const maxEstimate = hasHiscores
    ? hoursToMax(skills.map((s) => ({ name: s.name, level: s.level, xp: s.xp })))
    : { totalHours: 0, perSkill: [] };
  const actionQueue = nextBestActions({
    quests,
    diaries,
    skills,
    bank,
    accountType: accountMeta?.accountType ?? null,
    completedQuestNames,
    completedDiaryTiers: completedDiaryTierKeys
  });
  const returnPlan = buildReturnPlan({
    headline: recs[0] ?? null,
    nextBestActions: actionQueue,
    summary: input.scapestackSync?.lastSyncSummary ?? null,
    hasBank,
    hasPluginSync,
    pluginSyncState
  });

  return {
    headline: recs[0] ?? null,
    rest: recs.slice(1),
    nextBestActions: actionQueue,
    summary: {
      combatLevel,
      totalLevel,
      goalPercent,
      accountStage,
      accountType: accountMeta?.accountType ?? null,
      accountMode,
      basis,
      lastSyncSummary: input.scapestackSync?.lastSyncSummary ?? null
    },
    pathProgress,
    readiness,
    maxEstimate,
    returnPlan
  };
}
