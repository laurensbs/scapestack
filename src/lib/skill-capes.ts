// OSRS skill-cape item-IDs (regular, not trimmed). Looked up from the
// Wiki: each 99 skill mints a specific cape. We use these so the /next
// recommendations and the path-progress 'next steps' show the correct
// cape sprite per skill rather than the generic Attack cape (9747)
// fallback that was shipping before.
//
// IDs verified against oldschool.runescape.wiki/w/Skillcape — they match
// the chisel sprite endpoint.

export const SKILL_CAPE_IDS: Record<string, number> = {
  Attack: 9747,
  Strength: 9750,
  Defence: 9753,
  Ranged: 9756,
  Prayer: 9759,
  Magic: 9762,
  Runecraft: 9765,
  Hitpoints: 9768,
  Agility: 9771,
  Herblore: 9774,
  Thieving: 9777,
  Crafting: 9780,
  Fletching: 9783,
  Slayer: 9786,
  Mining: 9792,
  Smithing: 9795,
  Fishing: 9798,
  Cooking: 9801,
  Firemaking: 9804,
  Woodcutting: 9807,
  Farming: 9810,
  Construction: 9789,
  Hunter: 9948
};

/** Returns the OSRS item id for a skill's regular (untrimmed) skillcape.
 *  Falls back to the Attack cape (9747) if an unknown skill name comes
 *  in — that's the original generic-cape behaviour, preserved as a
 *  safety net for future skills the wiki adds. */
export function skillCapeId(skillName: string): number {
  return SKILL_CAPE_IDS[skillName] ?? 9747;
}
