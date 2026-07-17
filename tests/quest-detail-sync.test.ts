import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syncedSkillsToQuestHiscoreSkills } from "@/app/quests/[slug]/page";

const pageSource = readFileSync(join(process.cwd(), "src/app/quests/[slug]/page.tsx"), "utf8");
const clientSource = readFileSync(join(process.cwd(), "src/app/quests/[slug]/quest-detail-client.tsx"), "utf8");

describe("quest detail RuneLite sync contract", () => {
  it("converts synced RuneLite skills into quest requirement skill rows", () => {
    expect(syncedSkillsToQuestHiscoreSkills([
      { name: "Ranged", level: 42 },
      { name: "Slayer", level: 18 }
    ])).toEqual([
      { id: 1, name: "Ranged", level: 42, rank: 0, xp: 0 },
      { id: 2, name: "Slayer", level: 18, rank: 0, xp: 0 }
    ]);
  });

  it("uses synced player data for direct /quests/[slug]?rsn=Name readiness", () => {
    expect(pageSource).toContain("getSyncedPlayer(rsn)");
    expect(pageSource).toContain("const syncedSkills = syncedSkillsToQuestHiscoreSkills(syncedPlayer?.skills);");
    expect(pageSource).toContain("const skills = syncedSkills.length > 0 ? syncedSkills : hiscores?.skills ?? [];");
    expect(pageSource).toContain("const completedQuests = syncedPlayer?.questsCompleted ?? [];");
    expect(pageSource).toContain("bankItems: syncedPlayer?.bankItems ?? []");
    expect(pageSource).toContain("scapestackAccountTypeToPlannerType(syncedPlayer.accountType)");
    expect(pageSource).toContain('progressSource={syncedPlayer ? "runelite" : hiscores ? "hiscores" : "none"}');
    expect(pageSource).toContain("route.progress.activeQuestSlug !== currentSlug");
    expect(pageSource).toContain("redirect(`/quests/${route.progress.activeQuestSlug}${suffix}`)");
  });

  it("keeps browser bank as an additive fallback instead of replacing synced bank", () => {
    expect(clientSource).toContain("const [browserBankItems, setBrowserBankItems] = useState<QuestBankItem[]>([]);");
    expect(clientSource).toContain("normalizeQuestBankItems([...syncedBankItems, ...browserBankItems])");
    expect(clientSource).toContain("Browser bank used.");
    expect(clientSource).toContain("quest items are already in your bank");
  });

  it("shows one route-first quest block with exact requirements collapsed", () => {
    expect(pageSource).toContain("buildQuestRoute(targetQuest, quests");
    expect(pageSource).toContain("initialRoute={initialRoute}");
    expect(clientSource).toContain("Do this first");
    expect(clientSource).toContain('RouteStep label="Start"');
    expect(clientSource).toContain('label={evaluation.bank.notApplicable ? "Stage" : "Bring"}');
    expect(clientSource).toContain('RouteStep label="Get first"');
    expect(clientSource).toContain('RouteStep label="Stop"');
    expect(clientSource).toContain('RouteStep label="Next"');
    expect(clientSource).toContain("Check exact requirements");
    expect(clientSource).toContain("Open Wiki guide");
    expect(clientSource).toContain("questTripDecision(evaluation)");
    expect(clientSource).not.toContain("lg:grid-cols-4");
    expect(clientSource).not.toContain('Section title="Completed requirements"');
    expect(clientSource).not.toContain('Section title="Still missing"');
    expect(clientSource).not.toContain("Before you leave");
    expect(clientSource).not.toContain("Sync after");
  });
});
