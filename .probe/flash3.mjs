import { chromium } from "playwright";
const url = process.argv[2];
const cpu = Number(process.argv[3] ?? 1);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
await page.addInitScript(() => {
  window.__snaps = [];
  const t0 = performance.now();
  let last = "";
  const loop = () => {
    try {
      const t = document.body ? document.body.innerText : "";
      const sig = t.slice(0, 400);
      if (sig !== last) { window.__snaps.push({ t: Math.round(performance.now() - t0), text: t.slice(0, 700) }); last = sig; }
    } catch {}
    if (performance.now() - t0 < 12000) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(6000);
const snaps = await page.evaluate(() => window.__snaps);
for (const s of snaps) {
  console.log(`\n===== t=${s.t}ms =====`);
  console.log(s.text.replace(/\n+/g, " | "));
}
await browser.close();
