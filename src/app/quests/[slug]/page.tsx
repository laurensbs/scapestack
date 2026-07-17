import { notFound, redirect } from "next/navigation";
import { scapestackAccountTypeToPlannerType, type PlannerAccountType } from "@/lib/account-type";
import { fetchHiscores, type HiscoreSkill } from "@/lib/hiscores";
import { evaluateQuestRequirements } from "@/lib/quest-requirements";
import { buildQuestRoute } from "@/lib/quest-route";
import { questUnlockSignal } from "@/lib/quest-unlocks";
import { getQuestBySlug, getQuests, questSlug } from "@/lib/quest-db";
import { getSyncedPlayer } from "@/lib/sync-repo";
import { QuestDetailClient } from "./quest-detail-client";

type PageParams = { slug: string };
type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function syncedSkillsToQuestHiscoreSkills(
  skills: Array<{ name: string; level: number }> | null | undefined
): HiscoreSkill[] {
  return (skills ?? []).map((skill, index) => ({
    id: index + 1,
    name: skill.name,
    level: skill.level,
    rank: 0,
    xp: 0
  }));
}

export async function generateStaticParams(): Promise<PageParams[]> {
  const quests = await getQuests();
  return Array.from(quests.values()).map((quest) => ({ slug: questSlug(quest.name) }));
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params;
  const quest = await getQuestBySlug(slug);
  if (!quest) return { title: "Quest requirements" };
  return {
    title: `${quest.name} requirements`,
    description: `Skill, quest, item and bank checks for ${quest.name}.`
  };
}

export default async function QuestDetailPage({
  params,
  searchParams
}: {
  params: Promise<PageParams>;
  searchParams?: Promise<PageSearchParams>;
}) {
  const [{ slug }, search] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as PageSearchParams)
  ]);
  const quest = await getQuestBySlug(slug);
  if (!quest) notFound();

  const rsn = firstParam(search.rsn)?.trim() || null;
  const targetSlug = firstParam(search.target)?.trim() || null;
  const [syncedPlayer, hiscores, quests, requestedTarget] = await Promise.all([
    rsn ? getSyncedPlayer(rsn) : Promise.resolve(null),
    rsn ? fetchHiscores(rsn) : Promise.resolve(null),
    getQuests(),
    targetSlug ? getQuestBySlug(targetSlug) : Promise.resolve(null)
  ]);

  const accountType: PlannerAccountType | null = syncedPlayer
    ? scapestackAccountTypeToPlannerType(syncedPlayer.accountType)
    : null;
  const syncedSkills = syncedSkillsToQuestHiscoreSkills(syncedPlayer?.skills);
  const skills = syncedSkills.length > 0 ? syncedSkills : hiscores?.skills ?? [];
  const completedQuests = syncedPlayer?.questsCompleted ?? [];
  const targetQuest = requestedTarget ?? quest;
  const route = buildQuestRoute(targetQuest, quests, {
    skills,
    completedQuestNames: syncedPlayer ? completedQuests : undefined,
    completionEvidence: syncedPlayer ? "runelite" : undefined,
    bankItems: syncedPlayer?.bankItems ?? [],
    accountType,
    payoff: questUnlockSignal(targetQuest).label
  });
  const currentSlug = questSlug(quest.name);
  if (route.progress.activeQuestSlug !== currentSlug) {
    const query = new URLSearchParams();
    if (targetQuest.name !== route.activeQuest.name) query.set("target", questSlug(targetQuest.name));
    if (rsn) query.set("rsn", rsn);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    redirect(`/quests/${route.progress.activeQuestSlug}${suffix}`);
  }
  const initialEvaluation = evaluateQuestRequirements(quest, {
    skills,
    completedQuests,
    bankItems: syncedPlayer?.bankItems ?? [],
    accountType
  });
  const initialRoute = route.progress;

  return (
    <main className="relative z-10">
      <QuestDetailClient
        quest={quest}
        initialRoute={initialRoute}
        initialEvaluation={initialEvaluation}
        initialSkills={skills.map((skill) => ({ name: skill.name, level: skill.level }))}
        completedQuests={completedQuests}
        accountType={accountType}
        rsn={syncedPlayer?.displayName ?? rsn}
        syncedBankItems={syncedPlayer?.bankItems ?? []}
        progressSource={syncedPlayer ? "runelite" : hiscores ? "hiscores" : "none"}
      />
    </main>
  );
}
