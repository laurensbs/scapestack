/**
 * The Sunday recap — SPEC §3.3, the #1 return trigger.
 *
 * This module is pure: it turns a week of numbers into the exact strings the
 * spec specifies and nothing else. Delivery, tokens and the database live in
 * weekly-recap-repo.ts and the cron route, so the copy can be tested without a
 * network or a clock.
 */

export interface RecapGoalProgress {
  target: string;
  pctBefore: number;
  pctAfter: number;
  /** Goal-native units, per §3.1: "~14 Jad waves to go", "1.2M XP left". */
  remainder: string | null;
}

export interface RecapWeek {
  rsn: string;
  weekStart: string;
  xpGained: number;
  levelsGained: number;
  levelUps: Array<{ skill: string; from: number; to: number }>;
  kcGained: Record<string, number>;
  clogSlotsGained: number;
  goal: RecapGoalProgress | null;
  /** Absolute URL carrying the CTR token. */
  nextStepUrl: string;
}

/** 1.2M, 840k, 512 — the way a player writes it, not the way JSON does. */
export function compactXp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1))}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/**
 * The text bar from §3.3: `▓▓▓▓▓▓▓▓░░ 82%`.
 * Ten cells, floored — 99.4% must not render as a full bar, because a full bar
 * means done and the player would open the page to find they are not.
 */
export function textProgressBar(pct: number, cells = 10): string {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = Math.min(cells, Math.floor((clamped / 100) * cells));
  return `${"▓".repeat(filled)}${"░".repeat(cells - filled)} ${Math.round(clamped)}%`;
}

/**
 * A week with nothing in it must not be sent.
 *
 * The recap is the return trigger; a message saying "you gained nothing" is a
 * reason to mute the channel, and §1 is explicit that rewards attach to real
 * in-game progress. No progress, no message.
 */
export function weekIsWorthSending(week: RecapWeek): boolean {
  return week.xpGained > 0
    || week.levelsGained > 0
    || week.clogSlotsGained > 0
    || Object.keys(week.kcGained).length > 0
    || (week.goal !== null && week.goal.pctAfter > week.goal.pctBefore);
}

function topKc(kcGained: Record<string, number>, limit = 3): Array<[string, number]> {
  return Object.entries(kcGained).sort((left, right) => right[1] - left[1]).slice(0, limit);
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/**
 * The one-line summary, in §3.5's exact shape:
 * "🔥 This week on {RSN}: +1.2M XP, 3 new collection-log slots, and you're now
 *  82% to your Fire cape. ~14 Jad waves to go. Next step →"
 *
 * Clauses that have no number are dropped rather than written as zero: "0 new
 * collection-log slots" is noise, and a recap that lists what did not happen
 * reads as a form letter.
 */
export function recapHeadline(week: RecapWeek): string {
  const parts: string[] = [];
  if (week.xpGained > 0) parts.push(`+${compactXp(week.xpGained)} XP`);
  if (week.levelsGained > 0) {
    parts.push(`${week.levelsGained} level${week.levelsGained === 1 ? "" : "s"}`);
  }
  if (week.clogSlotsGained > 0) {
    parts.push(`${week.clogSlotsGained} new collection-log slot${week.clogSlotsGained === 1 ? "" : "s"}`);
  }
  const kc = topKc(week.kcGained, 1)[0];
  if (kc) parts.push(`${kc[1]} ${titleCase(kc[0])} KC`);

  const gains = parts.length > 1
    ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
    : parts[0] ?? "no tracked gains";

  const goalClause = week.goal
    ? ` You're now ${Math.round(week.goal.pctAfter)}% to your ${week.goal.target}.${week.goal.remainder ? ` ${week.goal.remainder} to go.` : ""}`
    : "";

  return `🔥 This week on ${week.rsn}: ${gains}.${goalClause} Next step →`;
}

export interface DiscordEmbed {
  title: string;
  url: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
}

/** §3.3's embed. Gold, because the accent is gold; nothing else is decided here. */
export function recapDiscordEmbed(week: RecapWeek): { content: string; embeds: DiscordEmbed[] } {
  const fields: DiscordEmbed["fields"] = [];

  if (week.xpGained > 0) {
    fields.push({ name: "XP", value: `+${compactXp(week.xpGained)}`, inline: true });
  }
  if (week.levelsGained > 0) {
    fields.push({
      name: week.levelsGained === 1 ? "Level" : "Levels",
      value: week.levelUps.length > 0
        ? week.levelUps.map((up) => `${titleCase(up.skill)} ${up.to}`).join(", ")
        : String(week.levelsGained),
      inline: true
    });
  }
  if (week.clogSlotsGained > 0) {
    fields.push({ name: "Collection log", value: `+${week.clogSlotsGained} slots`, inline: true });
  }
  const kc = topKc(week.kcGained);
  if (kc.length > 0) {
    fields.push({
      name: "KC",
      value: kc.map(([boss, gained]) => `${titleCase(boss)} +${gained}`).join("\n")
    });
  }
  if (week.goal) {
    fields.push({
      name: `Goal · ${week.goal.target}`,
      value: `${textProgressBar(week.goal.pctAfter)}${week.goal.remainder ? `\n${week.goal.remainder} to go` : ""}`
    });
  }

  return {
    content: "",
    embeds: [{
      title: `🔥 This week on ${week.rsn}`,
      url: week.nextStepUrl,
      color: 0xc9a961,
      fields,
      footer: { text: "Scapestack · unsubscribe in settings" }
    }]
  };
}

/** Plain and fast, per §3.3. Same content, one CTA. */
export function recapEmailText(week: RecapWeek): string {
  const lines = [recapHeadline(week).replace(" Next step →", ""), ""];
  if (week.goal) {
    lines.push(`${week.goal.target}`, textProgressBar(week.goal.pctAfter), "");
  }
  lines.push(`Your next step: ${week.nextStepUrl}`, "", "Scapestack · unsubscribe in settings");
  return lines.join("\n");
}
