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
  });

  it("keeps browser bank as an additive fallback instead of replacing synced bank", () => {
    expect(clientSource).toContain("const [browserBankItems, setBrowserBankItems] = useState<QuestBankItem[]>([]);");
    expect(clientSource).toContain("normalizeQuestBankItems([...syncedBankItems, ...browserBankItems])");
    expect(clientSource).toContain('SourceBadge label="Browser bank"');
    expect(clientSource).toContain("quest items found");
  });

  it("shows compact source and planning states on quest detail", () => {
    expect(clientSource).toContain('SourceBadge label="RuneLite synced"');
    expect(clientSource).toContain('SourceBadge label="Browser bank"');
    expect(clientSource).toContain('SourceBadge label="Bank not added"');
    expect(clientSource).not.toContain('SourceBadge label="No bank context"');
    expect(clientSource).toContain("questTripDecision(evaluation)");
    expect(clientSource).toContain("Quest trip");
    expect(clientSource).toContain("Next quest trip");
    expect(clientSource).toContain("Before you leave");
    expect(clientSource).toContain("Bring");
    expect(clientSource).toContain("Stage for UIM");
    expect(clientSource).toContain("Still missing");
    expect(clientSource).toContain("Finish after");
    expect(clientSource).toContain("Sync after");
    expect(clientSource).toContain("decision.bringItems.length > 0");
    expect(clientSource).toContain('Section title="Completed requirements"');
    expect(clientSource).toContain('Section title="Still missing"');
    expect(clientSource).toContain("UIM mode: this list is a staging checklist");
    expect(clientSource).toContain("accountModeVisual(accountType");
    expect(clientSource).not.toContain("Open this quest from `/next`");
  });
});
