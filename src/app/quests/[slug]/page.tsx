import { notFound } from "next/navigation";
import { scapestackAccountTypeToPlannerType, type PlannerAccountType } from "@/lib/account-type";
import { fetchHiscores, type HiscoreSkill } from "@/lib/hiscores";
import { evaluateQuestRequirements } from "@/lib/quest-requirements";
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
    description: `Skill, quest, item and bank readiness requirements for ${quest.name}.`
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
  const [syncedPlayer, hiscores] = rsn
    ? await Promise.all([
        getSyncedPlayer(rsn),
        fetchHiscores(rsn)
      ])
    : [null, null] as const;

  const accountType: PlannerAccountType | null = syncedPlayer
    ? scapestackAccountTypeToPlannerType(syncedPlayer.accountType)
    : null;
  const syncedSkills = syncedSkillsToQuestHiscoreSkills(syncedPlayer?.skills);
  const skills = syncedSkills.length > 0 ? syncedSkills : hiscores?.skills ?? [];
  const completedQuests = syncedPlayer?.questsCompleted ?? [];
  const initialEvaluation = evaluateQuestRequirements(quest, {
    skills,
    completedQuests,
    bankItems: syncedPlayer?.bankItems ?? [],
    accountType
  });

  return (
    <main className="relative z-10">
      <QuestDetailClient
        quest={quest}
        initialEvaluation={initialEvaluation}
        initialSkills={skills.map((skill) => ({ name: skill.name, level: skill.level }))}
        completedQuests={completedQuests}
        accountType={accountType}
        rsn={syncedPlayer?.displayName ?? rsn}
        syncedBankItems={syncedPlayer?.bankItems ?? []}
        bankStatus={syncedPlayer?.bankStatus ?? null}
        progressSource={syncedPlayer ? "runelite" : hiscores ? "hiscores" : "none"}
      />
    </main>
  );
}
