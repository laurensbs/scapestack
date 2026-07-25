import { fetchHiscores } from "@/lib/hiscores";
import { minigameRecs } from "@/lib/next-up-minigames";

const RSN = process.argv[2] ?? "Mr Mammal";
(async () => {
  const hs = await fetchHiscores(RSN);
  if (!hs) { console.log("no hiscores"); return; }
  const skills = hs.skills;
  const want = ["Runecraft", "Fishing", "Thieving", "Construction", "Mining", "Attack", "Hitpoints", "Firemaking", "Agility"];
  for (const w of want) {
    const s = skills.find((x) => x.name === w);
    console.log(`${w}: ${s ? s.level : "?"}`);
  }
  const recs = minigameRecs(skills);
  console.log("MINIGAME RECS:", recs.length);
  for (const r of recs) console.log("  ", r.id, "|", r.title, "| score", (r as any).score, "| link=", (r as any).link);
})();
