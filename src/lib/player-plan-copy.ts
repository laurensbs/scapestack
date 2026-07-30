import type { Recommendation } from "@/lib/next-up";

export function playerChoiceTag(rec: Recommendation): { label: string; helper: string } {
  if (rec.kind === "money") return { label: "GP", helper: "Pick this when you want cash or the next upgrade." };
  if (rec.kind === "boss" || rec.kind === "kc") return { label: "Bossing", helper: "Pick this when you want a PvM trip." };
  if (rec.kind === "skill") return { label: "AFK", helper: "Pick this when you want a low-pressure grind." };
  if (rec.kind === "bank" || rec.kind === "minigame") return { label: "Chill", helper: "Pick this when you want a lighter trip." };
  if (rec.kind === "slayer") return { label: "Slayer", helper: "Pick this when the task should drive the trip." };
  return { label: "Unlock", helper: "Pick this when you want quests, diary progress or account unlocks." };
}

export function backupChoicePrompt(
  rec: Recommendation,
  headline: Recommendation
): { label: string; helper: string } {
  if (rec.kind === "money") {
    return { label: "Need GP?", helper: "Pick this if funding the next upgrade matters more than the main route." };
  }
  if (rec.kind === "skill" || rec.kind === "bank" || rec.kind === "minigame") {
    return headline.kind === "boss" || headline.kind === "kc" || headline.kind === "slayer"
      ? { label: "Too sweaty?", helper: "Lower-pressure progress if the main trip feels like too much." }
      : { label: "Want chill?", helper: "Lower-pressure progress with a clearer stop point." };
  }
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") {
    return { label: "Want action?", helper: "Use this when you would rather do a trip, task or KC block." };
  }
  return { label: "Prefer unlock?", helper: "Use this when account progress matters more than GP or KC." };
}
