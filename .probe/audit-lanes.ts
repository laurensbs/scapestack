import { computeNextUp } from "../src/lib/next-up";
const SK = ["Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic","Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining","Herblore","Agility","Thieving","Slayer","Farming","Runecraft","Hunter","Construction"];
const lv: Record<string,number> = {Attack:85,Defence:80,Strength:87,Hitpoints:88,Ranged:90,Prayer:70,Magic:94,Cooking:85,Woodcutting:75,Fletching:75,Fishing:70,Firemaking:80,Crafting:75,Smithing:70,Mining:70,Herblore:72,Agility:70,Thieving:75,Slayer:78,Farming:72,Runecraft:70,Hunter:70,Construction:70};
const total = Object.values(lv).reduce((a,b)=>a+b,0);
const skills = [{name:"Overall",rank:1,level:total,xp:0} as any, ...SK.map(n=>({name:n,rank:1,level:lv[n],xp:0} as any))];
const bank = [{id:7462,name:"Barrows gloves",quantity:1},{id:9813,name:"Quest point cape",quantity:1},{id:6570,name:"Fire cape",quantity:1},{id:4251,name:"Ectophial",quantity:1},{id:12002,name:"Occult necklace",quantity:1}];
(async()=>{
const res = await computeNextUp({ skills, bank, questPoints: null, bossKc: {} });
console.log("unlockRoutes:");
for (const r of res.pathProgress.unlockRoutes) console.log(` - ${r.title} | blockersLeft=${r.blockersLeft} | need: ${r.nextBlocker} | action: ${r.nextAction}`);
const all=[res.headline,...res.rest].filter(Boolean) as any[];
console.log("\ntop3 quest/diary recs (what RouteProgressBoard renders):");
all.filter(r=>r.kind==="quest"||r.kind==="diary").slice(0,3).forEach(r=>console.log(` - ${r.title} :: ${r.why}`));
})();
