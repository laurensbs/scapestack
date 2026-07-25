import { chromium } from "playwright";
const url = process.argv[2];
const cpu = Number(process.argv[3] ?? 1);
const browser = await chromium.launch();
for (const round of [1, 2]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.addInitScript(() => {
    window.__marks = [];
    const t0 = performance.now();
    const loop = () => {
      try {
        const t = document.body ? document.body.innerText : "";
        window.__marks.push({
          t: Math.round(performance.now() - t0),
          skeleton: t.includes("Picking your next trip"),
          intake: t.includes("Type your OSRS name"),
          card: t.includes("DO THIS FIRST")
        });
      } catch {}
      if (performance.now() - t0 < 15000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  const marks = await page.evaluate(() => window.__marks);
  let prev = null;
  const rows = [];
  for (const m of marks) {
    const k = `${m.skeleton}|${m.intake}|${m.card}`;
    if (k !== prev) { rows.push(m); prev = k; }
  }
  console.log(`--- round ${round} cpu=${cpu}x cold=${round === 1} ---`);
  rows.forEach((r) => console.log(JSON.stringify(r)));
  const firstIntake = rows.find((r) => r.intake);
  const afterIntake = firstIntake ? rows.find((r) => r.t > firstIntake.t && !r.intake) : null;
  console.log("intake window ms:", firstIntake && afterIntake ? afterIntake.t - firstIntake.t : "n/a");
  await ctx.close();
}
await browser.close();
