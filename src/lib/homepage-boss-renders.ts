/**
 * Curated homepage subjects resolved through the OSRS Wiki pageimages API on
 * 2026-08-02 with `prop=pageimages&piprop=original`.
 *
 * The resolved originals are committed deliberately. Rendering the homepage
 * never calls MediaWiki's API, so choosing today's subject does not depend on
 * the wiki being available at request time.
 */
export interface HomepageBossRender {
  slug: string;
  name: string;
  wikiTitle: string;
  originalUrl: string;
  width: number;
  height: number;
}

export const HOMEPAGE_BOSS_RENDERS = [
  {
    slug: "vorkath",
    name: "Vorkath",
    wikiTitle: "Vorkath",
    originalUrl: "https://oldschool.runescape.wiki/images/Vorkath.png?1ce3f",
    width: 1615,
    height: 793
  },
  {
    slug: "zulrah",
    name: "Zulrah",
    wikiTitle: "Zulrah",
    originalUrl: "https://oldschool.runescape.wiki/images/Zulrah_%28serpentine%29.png?29a54",
    width: 834,
    height: 924
  },
  {
    slug: "cerberus",
    name: "Cerberus",
    wikiTitle: "Cerberus",
    originalUrl: "https://oldschool.runescape.wiki/images/Cerberus.png?47f4c",
    width: 1367,
    height: 1296
  },
  {
    slug: "nex",
    name: "Nex",
    wikiTitle: "Nex",
    originalUrl: "https://oldschool.runescape.wiki/images/Nex.png?2a1b3",
    width: 1347,
    height: 1568
  },
  {
    slug: "araxxor",
    name: "Araxxor",
    wikiTitle: "Araxxor",
    originalUrl: "https://oldschool.runescape.wiki/images/Araxxor.png?35d2e",
    width: 1760,
    height: 1066
  },
  {
    slug: "vardorvis",
    name: "Vardorvis",
    wikiTitle: "Vardorvis",
    originalUrl: "https://oldschool.runescape.wiki/images/Vardorvis.png?48af8",
    width: 1008,
    height: 1828
  },
  {
    slug: "corporeal-beast",
    name: "Corporeal Beast",
    wikiTitle: "Corporeal Beast",
    originalUrl: "https://oldschool.runescape.wiki/images/Corporeal_Beast.png?52ebb",
    width: 1551,
    height: 1519
  },
  {
    slug: "kraken",
    name: "Kraken",
    wikiTitle: "Kraken",
    originalUrl: "https://oldschool.runescape.wiki/images/Kraken.png?a4955",
    width: 1185,
    height: 885
  },
  {
    slug: "alchemical-hydra",
    name: "Alchemical Hydra",
    wikiTitle: "Alchemical Hydra",
    originalUrl: "https://oldschool.runescape.wiki/images/Alchemical_Hydra_%28serpentine%29.png?925dd",
    width: 1356,
    height: 1497
  },
  {
    slug: "phantom-muspah",
    name: "Phantom Muspah",
    wikiTitle: "Phantom Muspah",
    originalUrl: "https://oldschool.runescape.wiki/images/Phantom_Muspah_%28ranged%29.png?9cf6a",
    width: 1427,
    height: 1437
  },
  {
    slug: "general-graardor",
    name: "General Graardor",
    wikiTitle: "General Graardor",
    originalUrl: "https://oldschool.runescape.wiki/images/General_Graardor.png?4dd90",
    width: 779,
    height: 934
  },
  {
    slug: "duke-sucellus",
    name: "Duke Sucellus",
    wikiTitle: "Duke Sucellus",
    originalUrl: "https://oldschool.runescape.wiki/images/Duke_Sucellus.png?d588a",
    width: 1756,
    height: 1949
  }
] as const satisfies readonly HomepageBossRender[];

export type HomepageBossSlug = typeof HOMEPAGE_BOSS_RENDERS[number]["slug"];

export function homepageBossRenderBySlug(slug: string): HomepageBossRender | null {
  return HOMEPAGE_BOSS_RENDERS.find((boss) => boss.slug === slug) ?? null;
}
