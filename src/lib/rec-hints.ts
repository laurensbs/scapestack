// Default "what do I need / how do I act on this" copy per RecKind.
// Recommendation-generators kunnen dit overrulen door hun eigen
// `needs` + `details` te zetten. Voor v1 geeft dit een minimum-
// baseline detail-expand zodat geen enkele rec leeg is in de UI.
//
// Bewust afgesplitst van next-up.ts: die file leest JSON via fs/promises
// en kan dus niet vanaf een client component geïmporteerd worden.
// rec-hints.ts is pure — geen file-system, geen network, geen DB —
// zodat /next's expand-panel hem rechtstreeks kan gebruiken.

import type { RecKind } from "./next-up";

export interface ActionHints {
  needs: string[];
  details: string;
}

export function defaultActionHints(kind: RecKind): ActionHints {
  switch (kind) {
    case "goal":
      return {
        needs: ["Open unlocks", "Check the missing piece"],
        details: "Good when you want a visible unlock. Start with the closest missing item, tier or requirement."
      };
    case "quest":
      return {
        needs: ["Check requirements", "Bring teleports and food"],
        details: "Quests unlock travel, bosses, items and better training. If a step is confusing, use Quest Helper."
      };
    case "diary":
      return {
        needs: ["Check the tier", "Bring teleports"],
        details: "Diaries give permanent perks. Do the lowest unfinished tier first, then move up."
      };
    case "boss":
      return {
        needs: ["Check your setup", "Bring food and prayer"],
        details: "Good when you want PvM practice or KC. Try one short trip before committing."
      };
    case "kc":
      return {
        needs: ["Do a short trip", "Bank loot after the target"],
        details: "A 25-50 KC goal is a clean test. Stop if the setup feels bad."
      };
    case "minigame":
      return {
        needs: ["Check entry", "Know the reward"],
        details: "Best when you want one specific reward, like Void or Fighter torso."
      };
    case "money":
      return {
        needs: ["Check GE prices before you start", "Stock up on supplies"],
        details: "Good when you need cash now. Do a short run first and stop if prices or supplies look bad."
      };
    case "slayer":
      return {
        needs: ["Check current task", "Bring the right style"],
        details: "Slayer is best when the task is clear: kill, skip, extend, burst or cannon."
      };
    case "skill":
      return {
        needs: ["Pick AFK or focused", "Stock supplies"],
        details: "Choose the method that matches your attention. AFK is fine when you just want progress."
      };
    case "bank":
      return {
        needs: ["Check gear", "Paste bank"],
        details: "Good when your setup feels messy. Clean tabs make the next trip faster."
      };
    case "milestone":
      return {
        needs: ["Break it into one step"],
        details: "Big goals feel better as one next task. Do the nearest blocker first."
      };
  }
}
