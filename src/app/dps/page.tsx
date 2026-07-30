import { redirect } from "next/navigation";
import { bankIntakeForSection, playerToolSectionPath, rsnFromToolQuery } from "@/lib/player-tool-route";
import { resolveViewerRsn } from "@/lib/viewer-account";

export const metadata = {
  title: "Bosses",
  description: "See which bosses this bank can kill on the player's Scapestack page."
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DpsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = await (searchParams ?? Promise.resolve({} as SearchParams));
  const rsn = rsnFromToolQuery(query) || await resolveViewerRsn();
  redirect(rsn ? playerToolSectionPath(rsn, "bosses") : bankIntakeForSection("bosses"));
}
