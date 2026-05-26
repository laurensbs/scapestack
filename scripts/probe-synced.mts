// Dev probe: read back what the plugin POSTed via the same getSyncedPlayer
// path the UI uses. Lets us prove the round-trip end-to-end.
//
// Usage: npx tsx scripts/probe-synced.mts <rsn>

import { getSyncedPlayer } from "../src/lib/sync-repo.ts";

const rsn = process.argv[2] ?? "Lynx Titan";
const p = await getSyncedPlayer(rsn);
if (!p) {
  console.log(`No sync row for "${rsn}"`);
  process.exit(0);
}
console.log(JSON.stringify({
  rsn: p.rsn,
  displayName: p.displayName,
  syncedAt: p.syncedAt,
  pluginVersion: p.pluginVersion,
  questsCount: p.questsCompleted.length,
  firstFiveQuests: p.questsCompleted.slice(0, 5),
  diariesCount: p.diariesCompleted.length,
  diariesSample: p.diariesCompleted.slice(0, 5),
  clItemsCount: p.collectionLogItemIds.length,
  clItemsSample: p.collectionLogItemIds.slice(0, 5),
}, null, 2));
