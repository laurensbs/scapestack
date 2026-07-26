// Where each boss becomes a sensible suggestion.
//
// Not a hard requirement — OSRS rarely has those for bosses — but the combat
// level at which the fight stops being a bad idea. Every bar comes off that
// boss's own wiki page: the suggested-skills section where one exists, the
// game's own warning where it does not, and the stated combat level where the
// page gives one outright.
//
// This lives in its own module because two very different things need it: the
// /next engine, which decides what to recommend, and the /dps roster, which is
// a client component and must not pull the engine into the browser bundle.
// Keeping a second copy in the component is what this file replaces — the two
// had already diverged by twenty-five entries, and nothing would have said so.
//
// Slugs match BOSSES in bosses.ts exactly; a test asserts every combat boss
// there has an entry here, because a boss with no entry is not "ungated" — it
// is invisible to /next entirely.

export const BOSS_CL_GATE: Record<string, number> = {
  "obor": 50, "bryophyta": 55, "giant-mole": 65,
  // bosses.ts has both "kbd" and "king-black-dragon" as legacy duplicates;
  // listing only one prevents the same boss appearing twice in the hub.
  "barrows": 75, "king-black-dragon": 80, "sarachnis": 80,
  "dks-rex": 85, "dks-prime": 85, "dks-supreme": 85, "kraken": 85,
  "zulrah": 90, "sire": 95, "thermonuclear": 90, "skotizo": 95,
  "vorkath": 100, "graardor": 100, "kree": 100, "cerberus": 100,
  "grotesque-guardians": 100, "phantom-muspah": 105, "demonic-gorillas": 105,
  "zilyana": 110, "kril": 110, "hydra": 110, "araxxor": 110,
  "vardorvis": 115, "leviathan": 115, "whisperer": 115, "duke-sucellus": 115,
  "nex": 120,

  // Half the roster used to stop here. bossRecs does `if (gate === undefined)
  // continue`, so thirty of sixty bosses were invisible to /next entirely —
  // including Hespori, Amoxliatl and Moons of Peril, which sit exactly in the
  // mid-level band the reachable-boss fallback was written to serve and which
  // it could therefore never reach either.
  //
  // Every bar below comes off that boss's own wiki page — the suggested-skills
  // section where one exists, the game's own warning where it does not, and the
  // stated combat level where the page gives one outright. Same rule as
  // game-updates.ts: sourced, not recalled.

  // Wilderness. The combat level is the whole gate; these are fought in
  // risk-appropriate gear, so there is nothing sensible to check a bank for.
  // The lesser variants sit at the same bar as their parents because the wiki
  // gives them the same suggested skills.
  "crazy-archaeologist": 60, "deranged-archaeologist": 60,
  "chaos-fanatic": 70, "scorpia": 70,
  "spindel": 85, "chaos-elemental": 90,
  "callisto": 90, "artio": 90, "venenatis": 90, "vetion": 90, "calvarion": 90,

  // Farming and Slayer gates rather than combat ones, so the bar is set where
  // the fight itself stops being dangerous.
  "hespori": 55,          // real gate is 65 Farming
  "amoxliatl": 75,        // 48 Slayer + The Heart of Darkness
  "moons-of-peril": 75,   // the wiki states 75 outright
  "hueycoatl": 85,        // the game warns below combat 85 / 43 Prayer
  "galvek": 90,           // repeatable only after Dragon Slayer II
  "mimic": 90,            // the real gate is a master or elite casket
  "kalphite-queen": 95,

  // Fight Caves and Inferno. Jad's bar is the standard ranged route; the melee
  // route wants far more, which the gear gate below reflects.
  "tztok-jad": 80, "tzkal-zuk": 100,

  // Raids and the endgame solo content, in the order the wiki's own suggested
  // skills put them.
  "toa": 90, "fortis-colosseum": 90, "cox": 100, "corp": 100, "tob": 110
};
