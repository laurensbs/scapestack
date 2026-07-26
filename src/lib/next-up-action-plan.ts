// Action-plan enrichment for the /next engine.
//
// Sources produce a recommendation with a raw planSeed; this layer turns that
// into the contract the UI renders: a timebox, an honest confidence label, a
// short prep line, 2-4 executable steps, and the route chain ("do this first
// → after that → if blocked → next login").
//
// Confidence is driven by what Scapestack actually knows. Without a bank or a
// RuneLite sync the plan says so rather than presenting a guess as exact.

import { buildCalculableSkillRoute } from "./calculable-route";
import { recommendationSessionProfile } from "./recommendation-session";
import type {
  Recommendation,
  RecommendationActionPlan,
  RecommendationRouteChain
} from "./next-up-types";


// ── Action-plan enrichment ──────────────────────────────────────────────────

export interface ActionPlanContext {
  hasHiscores: boolean;
  hasBank: boolean;
  hasPluginSync: boolean;
  hasExactPluginSync: boolean;
}

function confidenceFor(rec: Recommendation, ctx: ActionPlanContext): RecommendationActionPlan["confidence"] {
  if (ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) return "exact";
  if (ctx.hasHiscores && ctx.hasBank) return "likely";
  if (ctx.hasHiscores && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "skill" || rec.kind === "boss" || rec.kind === "money" || rec.kind === "minigame")) return "likely";
  if (ctx.hasBank && (rec.kind === "goal" || rec.kind === "bank")) return "likely";
  return "guided";
}

function confidenceLabel(confidence: RecommendationActionPlan["confidence"]): string {
  if (confidence === "exact") return "Synced";
  if (confidence === "likely") return "Likely fit";
  return "Guided";
}

function baseCaveat(rec: Recommendation, ctx: ActionPlanContext): string | undefined {
  if (!ctx.hasHiscores && ctx.hasBank) return "Add your RSN to turn this into stat-aware advice.";
  if (ctx.hasHiscores && !ctx.hasBank && (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "goal")) return "Paste a bank when gear and item checks matter.";
  if (ctx.hasPluginSync && !ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) {
    return "RuneLite sync is connected, but refresh or update it before relying on quests, diaries, collection log or Slayer for this pick.";
  }
  if (!ctx.hasPluginSync && (rec.kind === "quest" || rec.kind === "diary")) return "Quest and diary completion is inferred unless Scapestack Sync has this RSN.";
  return undefined;
}

function mergePlanSeed(
  rec: Recommendation,
  ctx: ActionPlanContext,
  fallback: Omit<RecommendationActionPlan, "confidence" | "confidenceLabel">
): RecommendationActionPlan {
  const confidence = confidenceFor(rec, ctx);
  const { flow: _flow, ...seeded } = rec.planSeed ?? {};
  return {
    ...fallback,
    ...seeded,
    caveat: seeded.caveat ?? fallback.caveat ?? baseCaveat(rec, ctx),
    confidence,
    confidenceLabel: confidenceLabel(confidence)
  };
}

function actionPlanFor(rec: Recommendation, ctx: ActionPlanContext): RecommendationActionPlan {
  const bankStep = ctx.hasBank
    ? "Use your pasted bank to pull the gear, teleports and supplies for the trip."
    : "Paste your bank if you want Scapestack to verify the exact gear and supplies.";

  switch (rec.kind) {
    case "goal":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-90 min",
        prep: "Treat this as the next unlock chase, not a vague collection note.",
        steps: [
          "Open the goal set and check the missing pieces.",
          bankStep,
          "Do one focused run/session for the nearest missing item, then re-sync or paste again."
        ]
      });
    case "quest":
      return mergePlanSeed(rec, ctx, {
        timebox: "1-3 hr",
        prep: "Quest first when it unlocks more bosses, diaries or travel than another bankstanding upgrade.",
        steps: [
          "Check the first unmet prerequisite before you start the guide.",
          "Bank required teleports, stamina/energy, food and combat gear before leaving the GE.",
          "Finish the quest or clear one prerequisite, then check your plan for the unlocked follow-up."
        ]
      });
    case "diary":
      return mergePlanSeed(rec, ctx, {
        timebox: "45-120 min",
        prep: "Diary tiers are best done in batches: collect all items first, then sweep tasks region-by-region.",
        steps: [
          "Open the region checklist and mark any task you already know is done.",
          "Bank teleports, skill boosts and task items for the whole tier.",
          "Complete the shortest travel cluster first, then clean up the combat/minigame task last."
        ]
      });
    case "boss":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-60 min",
        prep: "Make this a scouting trip: prove the setup, then decide if it becomes a grind.",
        steps: [
          "Open the DPS view and use the best setup Scapestack can find from your bank.",
          "Bring supplies for 3-5 kills, not a marathon, so mistakes are cheap.",
          "After the test trip, compare kill time and supply cost before buying upgrades."
        ]
      });
    case "kc":
      return mergePlanSeed(rec, ctx, {
        timebox: "45-120 min",
        prep: "This one is pure drop chance: pick the KC block before you start, so going dry does not tilt the plan.",
        steps: [
          "Open the boss detail and sanity-check the owned setup.",
          "Run a fixed KC block (10, 25 or 50 kills depending on boss length).",
          "Re-sync after the block so the dry-rate and collection-log state update."
        ]
      });
    case "minigame":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-90 min",
        prep: "Minigames are unlock engines: do a small token/reward target, not an endless queue.",
        steps: [
          "Check the world/activity requirements before gearing.",
          "Pick one thing to finish: a reward roll, an outfit piece, or a level bracket.",
          "Stop after the target and let your plan re-rank the account."
        ]
      });
    case "money":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-60 min",
        prep: "Use this to fund the next unlock, not as permanent autopilot.",
        steps: [
          "Check current GE margins/supply prices before committing.",
          "Do one measured hour or half-hour and note real profit after supplies.",
          "Spend the cash on the highest-impact upgrade or quest supply stack next."
        ]
      });
    case "slayer":
      return mergePlanSeed(rec, ctx, {
        timebox: "20-60 min",
        prep: "This is live client state: finish the assignment already in front of you before starting a new grind.",
        steps: [
          "Open the Slayer task view and verify the current task, blocks and best master.",
          "Bank the correct protection item, teleports and cannon/burst supplies if relevant.",
          "Finish or deliberately skip the task, then let the plugin sync the next assignment."
        ]
      });
    case "skill":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-120 min",
        prep: "Push the unlock level, not random XP — stop when the account state changes.",
        steps: [
          "Take the fastest method you can stand for as long as you have.",
          "Bank or buy the supplies for exactly the levels needed to unlock the milestone.",
          "Check your plan again once the level lands so quests, diaries and bosses unlock immediately."
        ]
      });
    case "bank":
      return mergePlanSeed(rec, ctx, {
        timebox: "10-20 min",
        prep: "Bank work pays off when it removes friction from every later trip.",
        steps: [
          "Run Smart Tidy and copy the clean RuneLite tabs.",
          "Decant potions, recharge jewellery and move obvious junk before the next PvM/skilling run.",
          "Save the cleaned bank so future plans compare against the new baseline."
        ]
      });
    case "milestone":
      return mergePlanSeed(rec, ctx, {
        timebox: "Long-term",
        prep: "Treat this as the account arc; tonight's job is only the next step.",
        steps: [
          "Open the path overview and identify the closest incomplete lane.",
          "Clear one step that unlocks multiple downstream tasks.",
          "Pin the milestone mentally, but check your plan again after every major unlock."
        ]
      });
  }
}

function cleanRouteChainLine(value: string | null | undefined, fallback: string): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean || fallback;
}

function routeChainAfterThat(rec: Recommendation): string {
  switch (rec.kind) {
    case "skill":
      return "Stop when the level or unlock lands; the next route should change after that.";
    case "boss":
      return "If the first trip feels clean, turn it into a small KC block.";
    case "kc":
      return "Finish the KC block you chose before chasing another drop.";
    case "diary":
      return "Claim the reward, then let completed diary steps disappear from the plan.";
    case "quest":
      return "Take the reward and check which diary, boss or travel unlock opened.";
    case "slayer":
      return "Finish the task block, then let the next assignment change the route.";
    case "money":
      return "Bank the profit and spend it only if it unlocks the next trip.";
    case "bank":
      return "Copy the cleaned tabs into RuneLite, then plan the next trip from that bank.";
    case "goal":
      return "When the missing piece is done, move to the next closest set.";
    case "minigame":
      return "Stop after the reward target, not after an endless queue.";
    case "milestone":
      return "Clear one blocker, then re-rank the account arc.";
  }
}

function routeChainIfBlocked(rec: Recommendation, ctx: ActionPlanContext, plan: RecommendationActionPlan): string {
  if (!ctx.hasBank && (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer")) {
    return "Add bank before buying upgrades or committing to a longer trip.";
  }
  if (!ctx.hasPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "slayer")) {
    return "Use RuneLite later if finished quests, diary tiers or Slayer state might change this.";
  }
  if (ctx.hasPluginSync && !ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "slayer")) {
    return "Refresh RuneLite before relying on finished quests, diary tiers, clog or Slayer.";
  }
  if (
    plan.caveat &&
    !/payload|signals|readiness|data source|Plugin Hub|PR|exact account state|Scapestack Sync has this RSN/i.test(plan.caveat)
  ) {
    return plan.caveat;
  }
  if (rec.kind === "skill") return "If supplies run out, switch to a backup and keep the stop point.";
  if (rec.kind === "money") return "If prices moved, pick a safer GP backup instead of forcing it.";
  if (rec.kind === "bank") return "If the layout feels wrong, save nothing and keep the old bank.";
  return "If this feels wrong, pick a backup without resetting the whole account route.";
}

function routeChainNextLogin(ctx: ActionPlanContext): string {
  if (ctx.hasExactPluginSync) {
    return "Press Sync in RuneLite; Scapestack will skip finished stuff next login.";
  }
  if (ctx.hasPluginSync) {
    return "Refresh RuneLite before a long grind so the next pick does not repeat finished work.";
  }
  if (ctx.hasBank) {
    return "Open Scapestack again after the stop point; update bank only if gear or supplies changed.";
  }
  return "Open Scapestack again after the stop point; your skips and done picks shape the next route.";
}

function routeChainFor(
  rec: Recommendation,
  plan: RecommendationActionPlan,
  ctx: ActionPlanContext
): RecommendationRouteChain {
  if (rec.planSeed?.flow === "supply") {
    return {
      steps: [
        { label: "Source", text: cleanRouteChainLine(plan.steps[0], "Source one small supply block.") },
        { label: "Process", text: cleanRouteChainLine(plan.steps[1], "Process the sourced stack.") },
        { label: "Stop", text: cleanRouteChainLine(plan.steps[2], "Stop at the selected XP or level target.") },
        { label: "Next login", text: routeChainNextLogin(ctx) }
      ]
    };
  }
  const first = cleanRouteChainLine(plan.steps[0] ?? plan.prep, "Start the first useful step for this account.");
  return {
    steps: [
      { label: "Do this first", text: first },
      { label: "After that", text: routeChainAfterThat(rec) },
      { label: "If blocked", text: routeChainIfBlocked(rec, ctx, plan) },
      { label: "Next login", text: routeChainNextLogin(ctx) }
    ]
  };
}

function decisionReasonFor(rec: Recommendation, ctx: ActionPlanContext): string {
  if (rec.decisionReason) return rec.decisionReason;
  if (ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) {
    return "RuneLite skipped finished quests, diary steps, clog slots and Slayer mistakes for this pick.";
  }
  if (!ctx.hasBank && (rec.kind === "boss" || rec.kind === "kc")) {
    return "No bank was pasted, so gear advice stays conservative until you add gear.";
  }
  if (rec.payoff) return rec.payoff;
  return rec.why;
}

export function withActionPlans(recs: Recommendation[], ctx: ActionPlanContext): Recommendation[] {
  return recs.map((rec) => {
    const calculableRoute = rec.planSeed?.skillRoute
      ? buildCalculableSkillRoute(rec.planSeed.skillRoute)
      : null;
    const {
      planSeed: _planSeed,
      quality: _quality,
      gearConfidence: _gearConfidence,
      ...clean
    } = rec;
    const actionPlan = actionPlanFor(rec, ctx);
    return {
      ...clean,
      actionPlan,
      sessionProfile: recommendationSessionProfile({ ...rec, actionPlan }),
      routeChain: routeChainFor(rec, actionPlan, ctx),
      ...(calculableRoute ? { calculableRoute } : {}),
      decisionReason: decisionReasonFor(clean, ctx)
    };
  });
}

