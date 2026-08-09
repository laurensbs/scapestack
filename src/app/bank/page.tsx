import { redirect } from "next/navigation";
import { BankIntakeOnly } from "./bank-intake-only";
import {
  playerToolSectionPath,
  rsnFromToolQuery,
  sectionFromBankQuery
} from "@/lib/player-tool-route";
import { resolveViewerRsn } from "@/lib/viewer-account";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Was a section actually asked for?
 *
 * sectionFromBankQuery falls back to "sets" so that a paste always has
 * somewhere to land. That default is right for routing and wrong for copy: it
 * made bare /bank — the destination behind the nav's own "Setup" — render
 * "What can this bank finish?", the Sets page. Three labels sharing one form
 * was the defect; "Setup" silently becoming "Sets" is the same defect wearing
 * the opposite hat.
 */
function sectionWasRequested(query: SearchParams): boolean {
  const raw = query.section ?? query.from;
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return Boolean(value);
}

/**
 * The tab title has to agree with the heading.
 *
 * "Can I leave the bank?" was served for all four sections, so a player on the
 * boss roster read "Can I kill this?" on the page and "Can I leave the bank?"
 * in their tab — and every one of those URLs is in the sitemap under the same
 * title.
 */
const SECTION_TITLE: Record<string, string> = {
  bosses: "Can I kill this?",
  task: "Is this Slayer task worth it?",
  sets: "What can this bank finish?",
  money: "What pays for my account?"
};

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = await (searchParams ?? Promise.resolve({} as SearchParams));
  if (!sectionWasRequested(query)) return { title: "Can I leave the bank?" };
  return { title: SECTION_TITLE[sectionFromBankQuery(query)] ?? "Can I leave the bank?" };
}

export default async function BankPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = await (searchParams ?? Promise.resolve({} as SearchParams));
  const section = sectionFromBankQuery(query);
  const rsn = rsnFromToolQuery(query) || await resolveViewerRsn();
  if (rsn) redirect(playerToolSectionPath(rsn, section));
  return <BankIntakeOnly section={section} requested={sectionWasRequested(query)} />;
}
