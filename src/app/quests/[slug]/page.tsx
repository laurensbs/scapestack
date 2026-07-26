import { notFound, redirect } from "next/navigation";
import { scapestackAccountTypeToPlannerType, type PlannerAccountType } from "@/lib/account-type";
import { fetchHiscores, type HiscoreSkill } from "@/lib/hiscores";
import { evaluateQuestRequirements } from "@/lib/quest-requirements";
import { buildQuestRoute } from "@/lib/quest-route";
import { questUnlockSignal } from "@/lib/quest-unlocks";
import { getQuestBySlug, getQuests, questSlug } from "@/lib/quest-db";
import { getSyncedPlayer } from "@/lib/sync-repo";
import { resolveViewerRsn } from "@/lib/viewer-account";
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
  const [syncedPlayer, hiscores, quests, requestedTarget, viewerRsn] = await Promise.all([
    rsn ? getSyncedPlayer(rsn) : Promise.resolve(null),
    rsn ? fetchHiscores(rsn) : Promise.resolve(null),
    getQuests(),
    targetSlug ? getQuestBySlug(targetSlug) : Promise.resolve(null),
    rsn ? resolveViewerRsn() : Promise.resolve(null)
  ]);

  // /quests/<slug>?rsn=<name> is a public URL, and everything handed to the
  // client component below is serialised into the RSC payload embedded in the
  // HTML. This route was reading the snapshot straight from the database and
  // passing the whole bank down, so any name anyone typed returned that
  // player's full bank — item names, ids and quantities — to one curl.
  //
  // /next was fixed for exactly this in July; this route was missed, and then
  // half-fixed: only `syncedBankItems` was gated, while the same bank still
  // fed `buildQuestRoute` and `evaluateQuestRequirements` whose results cross
  // to the client too. EvaluatedItemRequirement carries `ownedName` and
  // `ownedQuantity`, and QuestRouteProgress carries formatted `ownedItems`, so
  // a stranger did not get the bank withheld — they got it filtered down to
  // the quest's item list, with real names and real stack sizes, and
  // quest-detail-client.tsx printed it as "In bank: 123456789x Coins."
  //
  // One bank variable now, gated once. Computing against a bank you are not
  // allowed to see is the bug, not the display of it.
  const isOwner = Boolean(viewerRsn && syncedPlayer && viewerRsn === syncedPlayer.rsn);
  const visibleBankItems = isOwner ? syncedPlayer?.bankItems ?? [] : [];

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
    bankItems: visibleBankItems,
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
    bankItems: visibleBankItems,
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
        syncedBankItems={visibleBankItems}
        progressSource={syncedPlayer ? "runelite" : hiscores ? "hiscores" : "none"}
      />
    </main>
  );
}
