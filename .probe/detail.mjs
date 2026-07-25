import { chromium } from "playwright";
const url = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.evaluate(() => { document.querySelectorAll("details").forEach(d => { d.open = true; }); });
await page.waitForTimeout(1000);
await page.evaluate(() => { document.querySelectorAll("details").forEach(d => { d.open = true; }); });
await page.waitForTimeout(600);
const txt = await page.evaluate(() => document.body.innerText);
console.log("=== FULL TEXT ===");
console.log(txt);
const c = (re) => (txt.match(re) || []).length;
console.log("=== COUNTS === GoTR:", c(/Guardians of the Rift/g),
  "| Varlamore:", c(/Varlamore/g),
  "| GrandmasterRoute:", c(/a Grandmaster quest route/g),
  "| progression:", c(/ progression/g));
await browser.close();
