import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCAPESTACK_AUDIT_URL ?? "https://www.scapestack.org";
const OUTPUT_DIR = path.resolve(
  process.env.SCAPESTACK_AUDIT_OUTPUT ?? "docs/qa/outcome-recovery/ODR-00"
);
const RUNS = Math.max(1, Number(process.env.SCAPESTACK_AUDIT_RUNS ?? 3));

const ROUTES = [
  { id: "home", path: "/", ready: "[aria-label='Stop bankstanding. Pick the next trip.']" },
  { id: "next", path: "/next?rsn=Lauky&intent=short&time=15", ready: "[data-next-trip-card='true']" },
  { id: "bank", path: "/bank?rsn=Lauky&from=odr00", ready: "[data-testid='bank-paste-input']" },
  {
    id: "boss",
    path: "/dps?rsn=Lauky&from=odr00",
    ready: "input[placeholder*='Search bosses'], [data-testid='bank-paste-input']"
  },
  { id: "goals", path: "/goals?rsn=Lauky&from=odr00", ready: "main h1" },
  {
    id: "plugin",
    path: "/plugin?rsn=Lauky&from=odr00",
    ready: "[aria-label='RuneLite connection']",
    readyText: /RuneLite is connected|Update Scapestack Sync|Refresh RuneLite|Press Sync now|Could not check RuneLite|Ready to check RuneLite/i
  },
  { id: "account", path: "/u/Lauky", ready: "[data-account-home-board='true']" }
];
const ROUTE_FILTER = new Set(
  (process.env.SCAPESTACK_AUDIT_ROUTES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const ACTIVE_ROUTES = ROUTE_FILTER.size > 0
  ? ROUTES.filter((route) => ROUTE_FILTER.has(route.id))
  : ROUTES;

const VIEWPORTS = [
  { id: "desktop", width: 1440, height: 1000, isMobile: false },
  { id: "mobile", width: 390, height: 844, isMobile: true }
];

await mkdir(path.join(OUTPUT_DIR, "screenshots"), { recursive: true });
await mkdir(path.join(OUTPUT_DIR, "ax"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const audit = {
  schemaVersion: 1,
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  browser: await browser.version(),
  runCount: RUNS,
  routes: []
};

try {
  for (const viewport of VIEWPORTS) {
    for (const route of ACTIVE_ROUTES) {
      const routeResult = {
        route: route.id,
        path: route.path,
        viewport,
        cold: [],
        warm: []
      };

      for (let run = 1; run <= RUNS; run += 1) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.isMobile,
          deviceScaleFactor: 1,
          reducedMotion: "reduce"
        });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

        const cold = await measure(page, cdp, route, "cold");
        routeResult.cold.push(cold);

        if (run === 1) {
          const prefix = `${viewport.id}-${route.id}`;
          await page.screenshot({
            path: path.join(OUTPUT_DIR, "screenshots", `${prefix}.png`),
            fullPage: true
          });
          const ax = await cdp.send("Accessibility.getFullAXTree");
          await writeFile(
            path.join(OUTPUT_DIR, "ax", `${prefix}.json`),
            `${JSON.stringify(ax, null, 2)}\n`
          );
          cold.axArtifact = `docs/qa/outcome-recovery/ODR-00/ax/${prefix}.json`;
          cold.screenshotArtifact = `docs/qa/outcome-recovery/ODR-00/screenshots/${prefix}.png`;
        }

        await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
        const warm = await measure(page, cdp, route, "warm");
        routeResult.warm.push(warm);
        await context.close();
      }

      routeResult.summary = summarize(routeResult);
      audit.routes.push(routeResult);
      process.stdout.write(
        `${viewport.id.padEnd(7)} ${route.id.padEnd(8)} `
        + `cold=${formatMs(routeResult.summary.coldMedianMs)} `
        + `warm=${formatMs(routeResult.summary.warmMedianMs)} `
        + `ready=${routeResult.summary.readyRuns}/${RUNS * 2} `
        + `errors=${routeResult.summary.errorCount}\n`
      );
    }
  }
} finally {
  await browser.close();
}

audit.summary = {
  routeViewportPairs: audit.routes.length,
  measuredNavigations: audit.routes.length * RUNS * 2,
  failedReadyRuns: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).filter((run) => !run.ready).length,
  consoleErrors: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).reduce((sum, run) => sum + run.consoleErrors.length, 0),
  pageErrors: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).reduce((sum, run) => sum + run.pageErrors.length, 0),
  hydrationErrors: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).reduce((sum, run) => sum + run.hydrationErrors.length, 0),
  overflowRuns: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).filter((run) => run.horizontalOverflowPx > 2).length,
  brokenImages: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).reduce((sum, run) => sum + run.brokenImages.length, 0),
  unnamedControls: audit.routes.flatMap((entry) => [...entry.cold, ...entry.warm]).reduce((sum, run) => sum + run.unnamedControls.length, 0)
};

await writeFile(
  path.join(OUTPUT_DIR, "production-routes.json"),
  `${JSON.stringify(audit, null, 2)}\n`
);

process.stdout.write(`Wrote ${path.join(OUTPUT_DIR, "production-routes.json")}\n`);

async function measure(page, cdp, route, mode) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  const onConsole = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error) => pageErrors.push(error.message);
  const onRequestFailed = (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText ?? "unknown"
    });
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  const startedAt = Date.now();
  let status = null;
  let navigationError = null;
  try {
    const response = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000
    });
    status = response?.status() ?? null;
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }
  const domContentLoadedMs = Date.now() - startedAt;

  let shellReady = false;
  let readyError = null;
  try {
    await page.locator(route.ready).first().waitFor({ state: "visible", timeout: 35_000 });
    shellReady = true;
  } catch (error) {
    readyError = error instanceof Error ? firstLine(error.message) : String(error);
  }
  const shellReadyMs = Date.now() - startedAt;

  let ready = shellReady;
  if (shellReady && route.readyText) {
    try {
      await page.getByText(route.readyText).first().waitFor({ state: "visible", timeout: 35_000 });
      ready = true;
    } catch (error) {
      ready = false;
      readyError = error instanceof Error ? firstLine(error.message) : String(error);
    }
  }
  const actionableMs = Date.now() - startedAt;

  await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(300);

  const dom = await page.evaluate(() => {
    const root = document.documentElement;
    const images = Array.from(document.images);
    const brokenImages = images
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt }));
    const controls = Array.from(document.querySelectorAll(
      "button, a[href], input, select, textarea, [role='button'], [role='link']"
    ));
    const unnamedControls = controls
      .filter((element) => {
        if (element instanceof HTMLInputElement && element.type === "hidden") return false;
        const label = element.getAttribute("aria-label")
          || element.getAttribute("title")
          || element.getAttribute("alt")
          || element.textContent
          || (element instanceof HTMLInputElement ? element.placeholder || element.value : "");
        return !label.trim();
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        className: typeof element.className === "string" ? element.className.slice(0, 160) : ""
      }));

    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      horizontalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
      brokenImages,
      unnamedControls,
      headings: Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((heading) => ({ level: heading.tagName.toLowerCase(), text: heading.textContent?.trim() ?? "" }))
        .filter((heading) => heading.text),
      navigation: navigation
        ? {
            responseStartMs: Math.round(navigation.responseStart),
            domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
            loadEventMs: Math.round(navigation.loadEventEnd)
          }
        : null
    };
  });

  const ax = await cdp.send("Accessibility.getFullAXTree");
  const axNodes = ax.nodes ?? [];
  const axHeadings = axNodes
    .filter((node) => node.role?.value === "heading" && !node.ignored)
    .map((node) => node.name?.value ?? "");
  const axUnnamedInteractive = axNodes
    .filter((node) => ["button", "link", "textbox", "combobox", "checkbox", "radio"].includes(node.role?.value))
    .filter((node) => !node.ignored && !(node.name?.value ?? "").trim())
    .map((node) => ({ role: node.role?.value ?? "unknown", nodeId: node.nodeId }));

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);

  return {
    mode,
    status,
    shellReady,
    shellReadyMs,
    ready,
    navigationError,
    readyError,
    domContentLoadedMs,
    actionableMs,
    consoleErrors,
    pageErrors,
    hydrationErrors: [...consoleErrors, ...pageErrors].filter((message) => /hydration|Minified React error #418/i.test(message)),
    requestFailures,
    horizontalOverflowPx: dom.horizontalOverflowPx,
    brokenImages: dom.brokenImages,
    unnamedControls: [...dom.unnamedControls, ...axUnnamedInteractive],
    headings: dom.headings,
    axHeadings,
    navigationTiming: dom.navigation
  };
}

function summarize(entry) {
  const all = [...entry.cold, ...entry.warm];
  return {
    coldMedianMs: median(entry.cold.map((run) => run.actionableMs)),
    coldMinMs: Math.min(...entry.cold.map((run) => run.actionableMs)),
    coldMaxMs: Math.max(...entry.cold.map((run) => run.actionableMs)),
    warmMedianMs: median(entry.warm.map((run) => run.actionableMs)),
    warmMinMs: Math.min(...entry.warm.map((run) => run.actionableMs)),
    warmMaxMs: Math.max(...entry.warm.map((run) => run.actionableMs)),
    readyRuns: all.filter((run) => run.ready).length,
    errorCount: all.reduce((sum, run) => sum + run.consoleErrors.length + run.pageErrors.length, 0),
    hydrationErrorCount: all.reduce((sum, run) => sum + run.hydrationErrors.length, 0),
    overflowRuns: all.filter((run) => run.horizontalOverflowPx > 2).length,
    brokenImageCount: all.reduce((sum, run) => sum + run.brokenImages.length, 0),
    unnamedControlCount: all.reduce((sum, run) => sum + run.unnamedControls.length, 0)
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatMs(value) {
  return `${(value / 1000).toFixed(2)}s`;
}

function firstLine(value) {
  return value.split("\n", 1)[0];
}
