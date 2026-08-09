import { describe, expect, it } from "vitest";
import {
  compactXp,
  recapDiscordEmbed,
  recapEmailText,
  recapHeadline,
  textProgressBar,
  weekIsWorthSending,
  type RecapWeek
} from "@/lib/weekly-recap";

function week(overrides: Partial<RecapWeek> = {}): RecapWeek {
  return {
    rsn: "lauky",
    weekStart: "2026-08-03",
    xpGained: 1_200_000,
    levelsGained: 0,
    levelUps: [],
    kcGained: {},
    clogSlotsGained: 3,
    goal: { target: "Fire cape", pctBefore: 74, pctAfter: 82, remainder: "~14 Jad waves" },
    nextStepUrl: "https://www.scapestack.org/r/tok",
    ...overrides
  };
}

describe("the recap headline is the spec's sentence (§3.5)", () => {
  it("renders the shape the spec gives, with real numbers", () => {
    expect(recapHeadline(week())).toBe(
      "🔥 This week on lauky: +1.2M XP, and 3 new collection-log slots. You're now 82% to your Fire cape. ~14 Jad waves to go. Next step →"
    );
  });

  it("drops clauses that have no number instead of writing zero", () => {
    // "0 new collection-log slots" is noise, and a recap that lists what did
    // not happen reads as a form letter — which is exactly the thing a player
    // mutes.
    const line = recapHeadline(week({ clogSlotsGained: 0, xpGained: 840_000 }));
    expect(line).toContain("+840k XP");
    expect(line).not.toContain("0 new");
    expect(line).not.toContain("0 levels");
  });

  it("names the goal only when there is one", () => {
    expect(recapHeadline(week({ goal: null }))).not.toContain("% to your");
  });
});

describe("numbers a player would write", () => {
  it("compacts XP the way the game community does", () => {
    expect(compactXp(1_200_000)).toBe("1.2M");
    expect(compactXp(840_000)).toBe("840k");
    expect(compactXp(13_034_431)).toBe("13M");
    expect(compactXp(512)).toBe("512");
    expect(compactXp(0)).toBe("0");
  });

  it("never rounds an unfinished goal up to a full bar", () => {
    // A full bar means done. At 99.4% the player would open the page and find
    // they are not, which spends the trust the recap exists to build.
    expect(textProgressBar(99.4)).toBe("▓▓▓▓▓▓▓▓▓░ 99%");
    expect(textProgressBar(100)).toBe("▓▓▓▓▓▓▓▓▓▓ 100%");
    expect(textProgressBar(82)).toBe("▓▓▓▓▓▓▓▓░░ 82%");
    expect(textProgressBar(0)).toBe("░░░░░░░░░░ 0%");
  });

  it("clamps nonsense rather than rendering it", () => {
    expect(textProgressBar(-20)).toBe("░░░░░░░░░░ 0%");
    expect(textProgressBar(Number.NaN)).toBe("░░░░░░░░░░ 0%");
  });
});

describe("a week with nothing in it is not sent", () => {
  it("declines an empty week", () => {
    // The recap is the return trigger. "You gained nothing" is a reason to
    // mute the channel, and §1 ties every message to real in-game progress.
    expect(weekIsWorthSending(week({
      xpGained: 0, levelsGained: 0, clogSlotsGained: 0, kcGained: {},
      goal: { target: "Fire cape", pctBefore: 82, pctAfter: 82, remainder: null }
    }))).toBe(false);
  });

  it("sends when anything moved, including goal progress alone", () => {
    expect(weekIsWorthSending(week({ xpGained: 0, clogSlotsGained: 0 }))).toBe(true);
    expect(weekIsWorthSending(week({
      xpGained: 0, clogSlotsGained: 0,
      goal: { target: "Fire cape", pctBefore: 74, pctAfter: 82, remainder: null }
    }))).toBe(true);
    expect(weekIsWorthSending(week({
      xpGained: 0, clogSlotsGained: 0, goal: null, kcGained: { zulrah: 12 }
    }))).toBe(true);
  });
});

describe("the Discord embed carries §3.3's format", () => {
  const payload = recapDiscordEmbed(week({ levelsGained: 1, levelUps: [{ skill: "slayer", from: 92, to: 93 }], kcGained: { zulrah: 12 } }));
  const embed = payload.embeds[0];

  it("titles, links and signs itself as the spec says", () => {
    expect(embed.title).toBe("🔥 This week on lauky");
    expect(embed.url).toBe("https://www.scapestack.org/r/tok");
    expect(embed.footer.text).toBe("Scapestack · unsubscribe in settings");
  });

  it("renders the goal as a text bar", () => {
    const goalField = embed.fields.find((field) => field.name.startsWith("Goal ·"));
    expect(goalField?.value).toContain("▓▓▓▓▓▓▓▓░░ 82%");
    expect(goalField?.value).toContain("~14 Jad waves to go");
  });

  it("names the skill that levelled, not just a count", () => {
    expect(embed.fields.find((field) => field.name === "Level")?.value).toBe("Slayer 93");
  });

  it("carries no field for something that did not happen", () => {
    const quiet = recapDiscordEmbed(week({ clogSlotsGained: 0, kcGained: {}, levelsGained: 0 }));
    const names = quiet.embeds[0].fields.map((field) => field.name);
    expect(names).not.toContain("Collection log");
    expect(names).not.toContain("KC");
    expect(names).not.toContain("Levels");
  });
});

describe("the email says the same thing, plainly", () => {
  it("carries one CTA and the unsubscribe line", () => {
    const text = recapEmailText(week());
    expect(text).toContain("https://www.scapestack.org/r/tok");
    expect(text).toContain("unsubscribe in settings");
    expect(text.match(/https:\/\//g)).toHaveLength(1);
  });
});
