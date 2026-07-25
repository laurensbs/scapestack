// Ranking layer for the /next engine.
//
// Every recommendation source produces a raw `score`. This module is what
// turns that raw score into an order: quality profile, gear reality and
// account archetype each apply a multiplier, which is then converted into
// bounded score points so no single factor can run away with the list.
//
// Kept separate from the sources so tuning the ranking never means scrolling
// past two thousand lines of OSRS content data.

import { isIronPlannerAccount } from "./account-type";
import type { AccountMeta } from "./path-progress";
import type { AccountStage } from "./account-stage";
import type {
  RecKind,
  Recommendation,
  RecommendationQuality,
  RecommendationRouteTag
} from "./next-up-types";

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function isIronAccount(accountMeta?: AccountMeta | null): boolean {
  return isIronPlannerAccount(accountMeta?.accountType);
}

function hasRouteTag(rec: Recommendation, tag: RecommendationRouteTag): boolean {
  return rec.routeTags?.includes(tag) ?? false;
}

function isRiskyRecommendation(rec: Recommendation): boolean {
  const text = `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
  return rec.kind === "boss"
    || rec.kind === "kc"
    || rec.kind === "slayer"
    || /wilderness|wildy|revs?|revenue cave|pker|risk|boss/.test(text);
}

function ironSourceChainMultiplier(rec: Recommendation): number {
  const text = `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""} ${rec.planSeed?.prep ?? ""}`.toLowerCase();
  let multiplier = 1;
  if (hasRouteTag(rec, "iron")) multiplier *= 1.16;
  if (/herb|birdhouse|seed|nest|farming|hunter|supply loop/.test(text)) multiplier *= 1.14;
  if (/shop|sawmill|minigame|skilling|craft|diary|quest reward|unlock/.test(text)) multiplier *= 1.08;
  if (/teleport|fairy ring|travel|ava|herblore|protection prayer/.test(text)) multiplier *= 1.06;
  if (/buy from ge|grand exchange|gp\/hr|average loot|money/.test(text)) multiplier *= 0.72;
  return multiplier;
}

export function defaultQualityFor(rec: Recommendation, hasBank: boolean): RecommendationQuality {
  const text = `${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
  const longQuest = rec.kind === "quest" && /\(\+\d+ more\)|long prereq|very long|grandmaster/.test(text);
  const scoutKc = rec.kind === "kc" && ((rec.kcMeta?.kc ?? 99) > 0 && (rec.kcMeta?.kc ?? 99) < 5);
  const bossWithoutGear = (rec.kind === "boss" || rec.kind === "kc")
    && rec.gearConfidence !== "confirmed"
    && rec.gearConfidence !== "likely"
    && rec.gearConfidence !== "not-needed";

  const byKind: Record<RecKind, RecommendationQuality> = {
    slayer: { accountFit: 0.98, actionability: 0.95, stopPoint: 0.92, gearConfidence: 0.72, unlockValue: 0.78, fun: 0.72, friction: 0.18 },
    goal: { accountFit: 0.86, actionability: 0.78, stopPoint: 0.86, gearConfidence: 0.72, unlockValue: 0.9, fun: 0.7, friction: 0.24 },
    diary: { accountFit: 0.78, actionability: 0.7, stopPoint: 0.78, gearConfidence: 0.75, unlockValue: 0.86, fun: 0.56, friction: 0.34 },
    quest: { accountFit: 0.75, actionability: longQuest ? 0.48 : 0.72, stopPoint: longQuest ? 0.55 : 0.75, gearConfidence: 0.7, unlockValue: 0.9, fun: 0.62, friction: longQuest ? 0.72 : 0.38 },
    boss: { accountFit: 0.7, actionability: bossWithoutGear ? 0.42 : 0.72, stopPoint: 0.8, gearConfidence: bossWithoutGear ? 0.38 : 0.8, unlockValue: 0.5, fun: 0.82, friction: bossWithoutGear ? 0.68 : 0.42 },
    kc: { accountFit: scoutKc ? 0.45 : 0.8, actionability: bossWithoutGear ? 0.42 : 0.76, stopPoint: scoutKc ? 0.64 : 0.86, gearConfidence: bossWithoutGear ? 0.38 : 0.82, unlockValue: 0.52, fun: 0.82, friction: scoutKc ? 0.6 : bossWithoutGear ? 0.68 : 0.38 },
    minigame: { accountFit: 0.78, actionability: 0.82, stopPoint: 0.82, gearConfidence: 0.9, unlockValue: 0.72, fun: 0.88, friction: 0.22 },
    money: { accountFit: 0.72, actionability: 0.78, stopPoint: 0.76, gearConfidence: hasBank ? 0.76 : 0.58, unlockValue: 0.62, fun: 0.58, friction: 0.32 },
    skill: { accountFit: 0.78, actionability: 0.84, stopPoint: 0.86, gearConfidence: 0.94, unlockValue: 0.74, fun: 0.6, friction: 0.2 },
    bank: { accountFit: 0.54, actionability: 0.95, stopPoint: 0.9, gearConfidence: 1, unlockValue: 0.35, fun: 0.25, friction: 0.08 },
    milestone: { accountFit: 0.74, actionability: 0.62, stopPoint: 0.62, gearConfidence: 0.74, unlockValue: 0.94, fun: 0.62, friction: 0.42 }
  };

  return rec.quality ?? byKind[rec.kind];
}

function qualityMultiplier(rec: Recommendation, hasBank: boolean): number {
  const q = defaultQualityFor(rec, hasBank);
  const positive =
    clamp01(q.accountFit) * 0.22
    + clamp01(q.actionability) * 0.2
    + clamp01(q.stopPoint) * 0.18
    + clamp01(q.gearConfidence) * 0.14
    + clamp01(q.unlockValue) * 0.16
    + clamp01(q.fun) * 0.1;
  const frictionPenalty = 1 - clamp01(q.friction) * 0.22;
  return (0.72 + positive * 0.5) * frictionPenalty;
}

function gearRealityMultiplier(rec: Recommendation, hasBank: boolean): number {
  if (rec.kind !== "boss" && rec.kind !== "kc" && rec.kind !== "money") return 1;
  if (rec.kind === "money") {
    const intense = `${rec.title} ${rec.why}`.toLowerCase();
    if (!hasBank && /(vorkath|zulrah|rune dragon|nex|boss)/.test(intense)) return 0.76;
    return 1;
  }

  if (rec.gearConfidence === "confirmed") return 1.12;
  if (rec.gearConfidence === "likely" || rec.gearConfidence === "not-needed") return 1.02;
  return hasBank ? 0.72 : 0.62;
}

function archetypeMultiplier(rec: Recommendation, accountStage: AccountStage, accountMeta?: AccountMeta | null): number {
  let multiplier = 1;
  const accountType = accountMeta?.accountType ?? null;
  const iron = isIronAccount(accountMeta);
  const text = `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
  const hasSourceHint = /shop|sawmill|skilling|craft|minigame|herb|birdhouse|seed|diary|quest|unlock/.test(text)
    || hasRouteTag(rec, "unlock");
  const isSupplyLoop = /herb|birdhouse|seed|nest|supply loop/.test(text);
  const shortAction = rec.actionPlan?.timebox
    ? /5-10|10-15|10-20|15-30|30-60|min/.test(rec.actionPlan.timebox.toLowerCase())
      && !/1-2 hr|2 hr|session/.test(rec.actionPlan.timebox.toLowerCase())
    : false;

  if (iron) {
    if (hasRouteTag(rec, "iron") || hasRouteTag(rec, "unlock")) multiplier *= 1.2;
    if (hasSourceHint && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "skill" || rec.kind === "minigame")) multiplier *= 1.08;
    multiplier *= ironSourceChainMultiplier(rec);
    if (rec.kind === "money") multiplier *= 0.45;
    if (rec.kind === "boss" || rec.kind === "kc") multiplier *= 0.9;
  }

  if (accountType === "hardcore") {
    if (isRiskyRecommendation(rec)) multiplier *= 0.52;
    if (hasSourceHint && !isRiskyRecommendation(rec)) multiplier *= 1.08;
    if (hasRouteTag(rec, "unlock") || rec.kind === "quest" || rec.kind === "diary") multiplier *= 1.12;
  } else if (accountType === "ultimate") {
    if (rec.kind === "bank") multiplier *= 0.35;
    if (rec.kind === "skill" || rec.kind === "quest" || rec.kind === "diary") multiplier *= 1.1;
    if (shortAction) multiplier *= 1.12;
    if (rec.actionPlan?.timebox && /1-2 hr|2 hr|90 min|120 min|session/i.test(rec.actionPlan.timebox)) multiplier *= 0.85;
  } else if (accountType === "group") {
    if (rec.kind === "money") multiplier *= 0.55;
    if (hasRouteTag(rec, "unlock") || rec.kind === "quest" || rec.kind === "diary") multiplier *= 1.08;
    if (hasSourceHint) multiplier *= 1.04;
  }

  switch (accountStage.id) {
    case "first-run":
    case "new-account":
      if (hasRouteTag(rec, "beginner") || rec.kind === "quest" || rec.kind === "skill") multiplier *= 1.18;
      if (rec.kind === "boss" || rec.kind === "kc") multiplier *= 0.38;
      break;
    case "early-main":
    case "returning":
      if ((hasRouteTag(rec, "returning") || hasRouteTag(rec, "unlock") || hasRouteTag(rec, "rebuild")) && rec.kind !== "money") multiplier *= 1.18;
      if (hasRouteTag(rec, "rebuild") && rec.kind === "money") multiplier *= 0.92;
      if (rec.kind === "kc" && (rec.kcMeta?.kc ?? 99) < 5) multiplier *= 0.55;
      break;
    case "iron-route":
      if (hasRouteTag(rec, "iron") || hasRouteTag(rec, "unlock")) multiplier *= 1.25;
      if (rec.kind === "money") multiplier *= 0.4;
      break;
    case "skiller":
      if (hasRouteTag(rec, "skiller") || hasRouteTag(rec, "afk") || rec.kind === "minigame") multiplier *= 1.2;
      if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") multiplier *= 0.22;
      break;
    case "pvm-ready":
      if (hasRouteTag(rec, "pvm") || rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") multiplier *= 1.14;
      if ((rec.kind === "boss" || rec.kind === "kc") && rec.gearConfidence === "unknown") multiplier *= 0.78;
      break;
    case "maxed-grinder":
      if (hasRouteTag(rec, "maxing") || rec.kind === "kc" || rec.kind === "goal") multiplier *= 1.28;
      if (rec.kind === "skill" && isSupplyLoop) multiplier *= 0.38;
      if (rec.kind === "bank" || rec.kind === "money") multiplier *= 0.6;
      if (rec.kind === "quest" || rec.kind === "diary") multiplier *= 0.82;
      break;
    case "runelite-aware":
      if (rec.kind === "slayer" || hasRouteTag(rec, "slayer")) multiplier *= 1.18;
      if (hasRouteTag(rec, "unlock")) multiplier *= 1.08;
      break;
    case "gear-first":
    case "midgame-main":
      if (hasRouteTag(rec, "pvm") || hasRouteTag(rec, "gp") || hasRouteTag(rec, "unlock")) multiplier *= 1.08;
      break;
  }

  return multiplier;
}

export function rankRecommendations(
  recs: Recommendation[],
  ctx: { hasBank: boolean; accountStage: AccountStage; accountMeta?: AccountMeta | null }
): Recommendation[] {
  return recs
    .map((rec) => {
      const multiplierPoints = (multiplier: number, weight: number): number =>
        clamp01(0.5 + Math.log2(Math.max(0.1, multiplier)) / 4) * weight - weight / 2;
      const qualityPoints = multiplierPoints(qualityMultiplier(rec, ctx.hasBank), 28);
      const gearPoints = multiplierPoints(gearRealityMultiplier(rec, ctx.hasBank), 34);
      const archetypePoints = multiplierPoints(archetypeMultiplier(rec, ctx.accountStage, ctx.accountMeta), 42);
      const score = rec.score + qualityPoints + gearPoints + archetypePoints;
      return { ...rec, score: Math.max(1, Math.round(score)) };
    })
    .sort((a, b) => b.score - a.score);
}
