import { redirect } from "next/navigation";
import { BankIntakeOnly } from "./bank-intake-only";
import {
  playerToolSectionPath,
  rsnFromToolQuery,
  sectionFromBankQuery
} from "@/lib/player-tool-route";
import { resolveViewerRsn } from "@/lib/viewer-account";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BankPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = await (searchParams ?? Promise.resolve({} as SearchParams));
  const section = sectionFromBankQuery(query);
  const rsn = rsnFromToolQuery(query) || await resolveViewerRsn();
  if (rsn) redirect(playerToolSectionPath(rsn, section));
  return <BankIntakeOnly section={section} />;
}
