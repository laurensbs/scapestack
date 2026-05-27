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
        needs: ["Open Goal Tracker", "Compare with your bank"],
        details: "Goal sets surface what you're closest to. Tap through to /goals for the full checklist + sprite grid."
      };
    case "quest":
      return {
        needs: ["Check quest requirements on the Wiki", "Bring teleports + grim food"],
        details: "Quests gate a lot of late-game unlocks (DT2, Sote, etc.). The Quest Helper plugin walks the steps."
      };
    case "diary":
      return {
        needs: ["Finish the tasks in your tier", "Diary cape for max"],
        details: "Diaries cascade: Easy → Medium → Hard → Elite. Pick the tier you're closest to first — instant XP lamp + region unlocks."
      };
    case "boss":
      return {
        needs: ["Check your gear in /dps", "Bring restore + brews"],
        details: "Combat bosses reward the right style + gear. /dps picks the optimal setup from your bank per boss."
      };
    case "kc":
      return {
        needs: ["Keep grinding"],
        details: "Drop chance ratchets up with every kill — no reset on a dry streak. The curve in the /dps modal shows expected KC remaining."
      };
    case "minigame":
      return {
        needs: ["Check entry requirements", "Pull up the rewards list on the Wiki"],
        details: "Minigames pay off for specific rewards (void, fighter torso). Wiki has a rewards-page per minigame."
      };
    case "money":
      return {
        needs: ["Check GE prices before you start", "Stock up on supplies"],
        details: "GP methods scale with level + investment. Short trips slot into any session; long grinds want commitment."
      };
    case "skill":
      return {
        needs: ["Pick a method", "Stock supplies"],
        details: "For 99: choose between AFK (Wintertodt-style) vs intensive (3-tick / tick-manipulation). The Time-to-max card shows where your grind sits."
      };
    case "bank":
      return {
        needs: ["Open Bank Organizer", "Paste your bank tags"],
        details: "Bank hygiene: drop junk, regroup tabs. /bank does it for you and hands back a clean copy-paste."
      };
    case "milestone":
      return {
        needs: ["Push for it"],
        details: "Account-wide milestones (quest cape, max cape) are long-term. Path-to-Max on this page shows what's blocking you most."
      };
  }
}
