#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const livePr = args.has("--live-pr");
const releasePlan = args.has("--plan");
const defaultStandaloneDir = `${process.env.HOME ?? ""}/code/scapestack-runelite-plugin`;
const pluginHubPrNumber = 12536;

function read(path) {
  return readFileSync(`${root}/${path}`, "utf8");
}

function fail(message) {
  throw new Error(message);
}

function match(path, pattern, label) {
  const text = read(path);
  const result = text.match(pattern);
  if (!result?.[1]) fail(`Missing ${label} in ${path}`);
  return result[1].trim();
}

function expectContains(path, needle) {
  if (!read(path).includes(needle)) fail(`${path} must contain: ${needle}`);
}

function expectRegex(path, pattern, message) {
  if (!pattern.test(read(path))) fail(message);
}

const RELEASE_IMPACT_PREFIXES = [
  "plugin/",
  "src/lib/plugin-sync.ts",
  "src/lib/plugin-hub-status.ts",
  "src/lib/plugin-",
  "src/app/plugin/",
  "src/components/plugin-",
  "scripts/print-plugin-review-packet.ts",
  "scripts/check-plugin-release.mjs",
  "scripts/extract-plugin.sh",
  "package.json",
  "tests/plugin-release-check.test.ts",
  "tests/plugin-hub-status.test.ts",
  "tests/plugin-review-packet.test.ts",
  "tests/plugin-page-copy.test.ts"
];

export function releaseImpactChangesFromStatus(statusText) {
  return statusText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).replace(/^"|"$/g, "");
      return { status: line.slice(0, 2).trim() || "modified", path };
    })
    .filter((entry) => RELEASE_IMPACT_PREFIXES.some((prefix) => entry.path.startsWith(prefix)));
}

const RELEASE_IMPACT_GROUPS = [
  {
    label: "Plugin source",
    matches: (path) => path.startsWith("plugin/src/main/")
  },
  {
    label: "Plugin tests",
    matches: (path) => path.startsWith("plugin/src/test/")
  },
  {
    label: "Plugin build/docs",
    matches: (path) => path.startsWith("plugin/")
  },
  {
    label: "Web Plugin surface",
    matches: (path) => path.startsWith("src/app/plugin/")
      || path.startsWith("src/components/plugin-")
      || path.startsWith("src/lib/plugin-")
      || path === "src/lib/plugin-hub-status.ts"
      || path === "src/lib/plugin-sync.ts"
  },
  {
    label: "Release tooling/tests",
    matches: (path) => path.startsWith("scripts/")
      || path.startsWith("tests/plugin-")
      || path === "package.json"
  }
];

export function groupReleaseImpactChanges(changes) {
  const groups = RELEASE_IMPACT_GROUPS.map(({ label }) => ({ label, changes: [] }));
  const other = { label: "Other release-impact", changes: [] };

  for (const change of changes) {
    const index = RELEASE_IMPACT_GROUPS.findIndex((group) => group.matches(change.path));
    if (index === -1) {
      other.changes.push(change);
    } else {
      groups[index].changes.push(change);
    }
  }

  return [...groups, other].filter((group) => group.changes.length > 0);
}

function localReleaseImpactChanges() {
  try {
    const output = execFileSync("git", ["status", "--short", ...RELEASE_IMPACT_PREFIXES], {
      cwd: root,
      encoding: "utf8"
    });
    return releaseImpactChangesFromStatus(output);
  } catch {
    return [];
  }
}

export function summarizeStandaloneStatus(statusText, head = "unknown", target = defaultStandaloneDir) {
  const changes = statusText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const shortHead = head && head !== "unknown" ? head.slice(0, 7) : "unknown";

  return {
    target,
    head,
    count: changes.length,
    dirty: changes.length > 0,
    summary: changes.length > 0
      ? `Standalone handoff repo: ${target} has ${changes.length} uncommitted path${changes.length === 1 ? "" : "s"} ready to commit from head ${shortHead}.`
      : `Standalone handoff repo: ${target} is clean at head ${shortHead}.`
  };
}

function standaloneReleaseStatus(target = defaultStandaloneDir) {
  if (!target || !existsSync(target)) {
    return {
      target,
      head: null,
      count: 0,
      dirty: false,
      summary: `Standalone handoff repo: ${target || "<unknown>"} is missing. Run ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin first.`
    };
  }

  try {
    const statusText = execFileSync("git", ["-C", target, "status", "--short"], {
      cwd: root,
      encoding: "utf8"
    });
    const head = execFileSync("git", ["-C", target, "rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    return summarizeStandaloneStatus(statusText, head, target);
  } catch {
    return {
      target,
      head: null,
      count: 0,
      dirty: false,
      summary: `Standalone handoff repo: ${target} is not a readable git checkout.`
    };
  }
}

function checkVersions() {
  const pkg = JSON.parse(read("package.json"));
  const expected = pkg.version;
  const versions = {
    "package.json": expected,
    "src/lib/plugin-sync.ts": match("src/lib/plugin-sync.ts", /CURRENT_PLUGIN_VERSION\s*=\s*"([^"]+)"/, "CURRENT_PLUGIN_VERSION"),
    "plugin/build.gradle": match("plugin/build.gradle", /version\s*=\s*['"]([^'"]+)['"]/, "Gradle version"),
    "plugin/runelite-plugin.properties": match("plugin/runelite-plugin.properties", /^version=(.+)$/m, "Plugin Hub manifest version"),
    "ScapestackSyncPlugin.PLUGIN_VERSION": match(
      "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      /PLUGIN_VERSION\s*=\s*"([^"]+)"/,
      "Java plugin version"
    )
  };

  for (const [source, version] of Object.entries(versions)) {
    if (version !== expected) fail(`${source} is ${version}, expected ${expected}`);
  }

  return expected;
}

function checkOptInDefaults() {
  expectRegex(
    "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncConfig.java",
    /default\s+boolean\s+autoSync\(\)\s*\{\s*return\s+false;\s*\}/,
    "autoSync must default to false for explicit Plugin Hub opt-in"
  );
  expectRegex(
    "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncConfig.java",
    /default\s+boolean\s+syncOnQuestComplete\(\)\s*\{\s*return\s+false;\s*\}/,
    "syncOnQuestComplete must default to false for explicit Plugin Hub opt-in"
  );
}

function checkReviewCopy() {
  for (const path of [
    "plugin/README.md",
    "plugin/PUBLISHING.md",
    "scripts/extract-plugin.sh",
    "src/app/plugin/page.tsx"
  ]) {
    expectContains(path, "Auto-sync on login");
  }

  for (const path of [
    "plugin/README.md",
    "plugin/runelite-plugin.properties",
    "scripts/extract-plugin.sh",
    "src/app/plugin/page.tsx"
  ]) {
    expectContains(path, "Slayer");
  }

  expectContains("plugin/PUBLISHING.md", "External HTTP calls without user opt-in");
  expectContains("plugin/PUBLISHING.md", "npm run plugin:review-packet");
  expectContains("plugin/PUBLISHING.md", "npm run plugin:review-reply-command");
  expectContains("plugin/PUBLISHING.md", "npm run plugin:review-handoff-command");
  expectContains("plugin/PUBLISHING.md", "Replace stale PR-body copy");
  expectContains("src/app/plugin/page.tsx", "does not POST progress until you enable");
  expectContains("src/lib/plugin-review-packet.ts", "background Thread, not on RuneLite's client thread");
  expectContains("src/lib/plugin-review-packet.ts", "No progress POST happens until the player enables Auto-sync on login");
  expectContains("src/lib/plugin-review-packet.ts", "replace stale PR-body copy");
  expectContains("scripts/print-plugin-review-packet.ts", "buildPluginReviewerPacket");
  expectContains("scripts/print-plugin-review-packet.ts", "buildPluginReviewerReplyCommand");
  expectContains("scripts/print-plugin-review-packet.ts", "--offline");

  for (const path of [
    "plugin/README.md",
    "plugin/PUBLISHING.md",
    "scripts/extract-plugin.sh",
    "src/app/plugin/page.tsx"
  ]) {
    expectContains(path, "RuneScape password");
    expectContains(path, "bank");
    expectContains(path, "inventory");
    expectContains(path, "chat");
  }
}

function listFiles(dir, base = dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) return listFiles(path, base);
      return path.slice(base.length + 1).replaceAll("\\", "/");
    })
    .sort();
}

export function disallowedStandalonePluginFiles(files) {
  const allowedFilePatterns = [
    /^\.gitignore$/,
    /^PUBLISHING\.md$/,
    /^README\.md$/,
    /^LICENSE$/,
    /^build\.gradle$/,
    /^gradlew$/,
    /^gradlew\.bat$/,
    /^runelite-plugin\.properties$/,
    /^gradle\/wrapper\/gradle-wrapper\.(jar|properties)$/,
    /^src\/main\/java\/app\/scapestack\/runelite\/[A-Za-z0-9_$]+\.java$/,
    /^src\/test\/java\/app\/scapestack\/runelite\/[A-Za-z0-9_$]+\.java$/
  ];
  const forbiddenPathPatterns = [
    /(^|\/)\.gradle(\/|$)/,
    /(^|\/)build(\/|$)/,
    /(^|\/)bin(\/|$)/,
    /\.class$/,
    /\.jar$/
  ];

  return files.filter((path) => {
    if (path === "gradle/wrapper/gradle-wrapper.jar") return false;
    if (forbiddenPathPatterns.some((pattern) => pattern.test(path))) return true;
    return !allowedFilePatterns.some((pattern) => pattern.test(path));
  });
}

function checkStandaloneExtractSurface() {
  const target = mkdtempSync(join(tmpdir(), "scapestack-plugin-release-"));
  try {
    execFileSync("bash", ["scripts/extract-plugin.sh", target, "--clean"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe"
    });
    const files = listFiles(target);
    const disallowed = disallowedStandalonePluginFiles(files);
    if (disallowed.length > 0) {
      fail(`Standalone extract contains disallowed Plugin Hub files: ${disallowed.join(", ")}`);
    }
  } finally {
    rmSync(target, { force: true, recursive: true });
  }
}

async function printLivePrStatus() {
  const prNumber = pluginHubPrNumber;
  const prPageUrl = `https://github.com/runelite/plugin-hub/pull/${prNumber}`;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "scapestack-plugin-release-check"
  };
  let prResponse;
  let reviewsResponse;
  let filesResponse;
  let standaloneResponse;
  try {
    [prResponse, reviewsResponse, filesResponse, standaloneResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/runelite/plugin-hub/pulls/${prNumber}`, { headers }),
      fetch(`https://api.github.com/repos/runelite/plugin-hub/pulls/${prNumber}/reviews`, { headers }),
      fetch(`https://api.github.com/repos/runelite/plugin-hub/pulls/${prNumber}/files`, { headers }),
      fetch("https://api.github.com/repos/laurensbs/scapestack-runelite-plugin/commits/main", { headers })
    ]);
  } catch (error) {
    fail(`Live Plugin Hub gate failed: GitHub fetch failed (${error instanceof Error ? error.message : String(error)})`);
  }

  if (!prResponse.ok) {
    await printPublicPrFallback(prPageUrl, prResponse.status);
    return;
  }

  const pr = await prResponse.json();
  const reviews = reviewsResponse.ok ? await reviewsResponse.json() : [];
  const files = filesResponse.ok ? await filesResponse.json() : [];
  const pluginHubFile = Array.isArray(files)
    ? files.find((file) => file.filename === "plugins/scapestack-sync")
    : null;
  const submittedCommit = typeof pluginHubFile?.patch === "string"
    ? pluginHubFile.patch.match(/^\+commit=([a-f0-9]{40})$/m)?.[1] ?? null
    : null;
  const standalone = standaloneResponse.ok ? await standaloneResponse.json() : null;
  const standaloneCommit = typeof standalone?.sha === "string" ? standalone.sha : null;
  const headSha = typeof pr.head?.sha === "string" ? pr.head.sha : null;
  const checksResponse = headSha
    ? await fetch(`https://api.github.com/repos/runelite/plugin-hub/commits/${headSha}/check-runs`, { headers })
    : null;
  const checksPayload = checksResponse?.ok ? await checksResponse.json() : null;
  const checks = Array.isArray(checksPayload?.check_runs) ? checksPayload.check_runs : [];
  const build = checks.find((check) => check.name === "build");
  const hub = checks.find((check) => check.name === "RuneLite Plugin Hub Checks");
  const state = pr.merged_at ? "merged" : pr.state ?? "unknown";
  const failures = [];
  const reviewCopyIssues = reviewCopyIssuesFromBody(pr.body);
  console.log(`Live PR: #${prNumber} ${state}, reviews=${Array.isArray(reviews) ? reviews.length : "unknown"}, updated=${pr.updated_at ?? "unknown"}`);
  if (submittedCommit) console.log(`Live Plugin Hub pin: ${submittedCommit}`);
  if (standaloneCommit) console.log(`Live standalone head: ${standaloneCommit}`);
  if (submittedCommit && standaloneCommit) {
    const pinMatches = submittedCommit === standaloneCommit;
    console.log(pinMatches
      ? "Live pin status: Plugin Hub pin matches standalone head"
      : "Live pin status: Plugin Hub pin is behind standalone head");
    if (!pinMatches) failures.push("Plugin Hub pin is behind standalone head");
  }
  if (build || hub) {
    console.log(`Live checks: build=${build?.conclusion ?? "unknown"}, pluginHubGate=${hub?.conclusion ?? "unknown"}`);
    if (build && build.conclusion !== "success") failures.push(`build check is ${build.conclusion ?? "unknown"}`);
  }
  console.log(reviewCopyIssues.length > 0
    ? `Live PR body: stale review copy (${reviewCopyIssues.join(", ")})`
    : "Live PR body: aligned with current opt-in, token, payload and privacy copy");
  if (reviewCopyIssues.length > 0) failures.push(`stale PR body copy: ${reviewCopyIssues.join(", ")}`);

  if (failures.length > 0) {
    fail(`Live Plugin Hub gate failed: ${failures.join("; ")}`);
  }
}

function decodeHtmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function publicPrStatusFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) return null;
  const text = decodeHtmlText(html);
  const lower = text.toLowerCase();
  if (!lower.includes(`add scapestack-sync#${pluginHubPrNumber}`) && !lower.includes(`add scapestack-sync #${pluginHubPrNumber}`)) {
    return null;
  }

  const state = lower.includes(`plugin hub pr #${pluginHubPrNumber} merged`)
    ? "merged"
    : lower.includes(`plugin hub pr #${pluginHubPrNumber} closed`)
      ? "closed"
      : lower.includes(`plugin hub pr #${pluginHubPrNumber} open`)
        ? "open"
        : lower.includes("awaiting runelite maintainer review")
          ? "open"
        : lower.includes(" merged ")
          ? "merged"
          : lower.includes(" closed ")
            ? "closed"
            : lower.includes(" open ")
              ? "open"
              : "unknown";
  return {
    state,
    reviewCount: lower.includes("no reviews") ? 0 : null,
    maintainerGate: lower.includes("this plugin requires a review from a plugin hub maintainer"),
    submittedCommit: html.match(/scapestack-runelite-plugin\/tree\/([a-f0-9]{40})/i)?.[1] ?? null,
    reviewCopyIssues: reviewCopyIssuesFromBody(text)
  };
}

async function printPublicPrFallback(prPageUrl, apiStatus) {
  const response = await fetch(prPageUrl, {
    headers: {
      accept: "text/html",
      "user-agent": "scapestack-plugin-release-check"
    }
  });

  if (!response.ok) {
    fail(`Live Plugin Hub gate failed: Live PR unavailable (${apiStatus}; public HTML ${response.status})`);
  }

  const status = publicPrStatusFromHtml(await response.text());
  if (!status) {
    fail(`Live Plugin Hub gate failed: Live PR unavailable (${apiStatus}; public HTML unreadable)`);
  }

  console.log(`Live PR: #${pluginHubPrNumber} ${status.state}, reviews=${status.reviewCount ?? "unknown"} (public HTML fallback after API ${apiStatus})`);
  if (status.submittedCommit) console.log(`Live Plugin Hub pin: ${status.submittedCommit}`);
  if (status.maintainerGate) console.log("Live checks: public PR page shows Plugin Hub maintainer review gate");
  console.log(status.reviewCopyIssues.length > 0
    ? `Live PR body: stale review copy (${status.reviewCopyIssues.join(", ")})`
    : "Live PR body: aligned with current opt-in, token, payload and privacy copy");
  if (status.reviewCopyIssues.length > 0) {
    fail(`Live Plugin Hub gate failed: stale PR body copy: ${status.reviewCopyIssues.join(", ")}`);
  }
}

export function reviewCopyIssuesFromBody(body) {
  if (typeof body !== "string" || !body.trim()) return ["missing PR body"];
  const normalized = body.toLowerCase().replace(/[‐‑‒–—]/g, "-");
  const issues = [];

  if (normalized.includes("auto-sync defaults to on")
    || (normalized.includes("auto") && normalized.includes("defaults to on"))) {
    issues.push("auto-sync defaults");
  }
  if (normalized.includes("raw token never leaves")) {
    issues.push("token transport");
  }
  if (normalized.includes("post `https://www.scapestack.org/api/sync` on every login")
    || normalized.includes("post https://www.scapestack.org/api/sync on every login")
    || normalized.includes("on every login + on quest-complete")) {
    issues.push("POST timing");
  }
  if (normalized.includes("shutdown interrupts")
    || normalized.includes("thread interrupt")
    || normalized.includes("interrupts the named daemon")
    || normalized.includes("interrupts that worker")
    || normalized.includes("interrupts it")) {
    issues.push("shutdown thread interrupt");
  }
  if (!normalized.includes("sync on quest complete defaults off")
    || !normalized.includes("quest-complete sync is also gated behind auto-sync on login")) {
    issues.push("quest-complete opt-in gate");
  }
  if (!normalized.includes("slayer")) {
    issues.push("Slayer payload");
  }
  if (!normalized.includes("bank") || !normalized.includes("inventory") || !normalized.includes("equipment")) {
    issues.push("bank/inventory/equipment exclusion");
  }

  return issues;
}

function printReleasePlan(version) {
  const releaseImpactChanges = localReleaseImpactChanges();
  const standaloneStatus = standaloneReleaseStatus();
  console.log("Release plan:");
  if (releaseImpactChanges.length > 0) {
    console.log(`Local release-impact changes: ${releaseImpactChanges.length} path${releaseImpactChanges.length === 1 ? "" : "s"} need extraction before Plugin Hub sees them.`);
  } else {
    console.log("Local release-impact changes: none detected.");
  }
  console.log("Release-impact groups:");
  if (releaseImpactChanges.length > 0) {
    for (const group of groupReleaseImpactChanges(releaseImpactChanges)) {
      console.log(`- ${group.label}: ${group.changes.length}`);
    }
  } else {
    console.log("- none");
  }
  console.log("First changed paths:");
  if (releaseImpactChanges.length > 0) {
    for (const change of releaseImpactChanges.slice(0, 12)) {
      console.log(`- ${change.status} ${change.path}`);
    }
    if (releaseImpactChanges.length > 12) {
      console.log(`- …and ${releaseImpactChanges.length - 12} more`);
    }
  } else {
    console.log("- none");
  }
  console.log(standaloneStatus.summary);
  if (standaloneStatus.dirty) {
    console.log(`Standalone next command: git -C ${standaloneStatus.target} status --short`);
  }
  console.log("1. Run npm run ci:check from the monorepo root.");
  console.log("2. Preview with ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin --dry-run.");
  console.log("3. Mirror the local plugin with ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin.");
  console.log(`4. In the standalone repo, commit and tag the extracted tree as v${version}.`);
  console.log("5. Push the standalone repo and copy its new full commit SHA.");
  console.log("6. Update runelite/plugin-hub plugins/scapestack-sync commit=<new sha> so reviewers see these local changes.");
  console.log("7. Re-run npm run plugin:release-check:live and confirm the Plugin Hub pin equals the standalone head.");
  console.log("8. Run npm run plugin:review-packet and replace stale PR-body copy before asking maintainers to re-review.");
  console.log("9. Run npm run plugin:review-reply-command to prepare the reviewer packet PR comment.");
  console.log("10. Run npm run plugin:review-handoff-command when GitHub CLI is authenticated and you want body + comment together.");
  console.log("11. Keep the PR body explicit: sync is opt-in, posted data is RSN + game-state only, HTTP runs off the client thread.");
}

async function main() {
  const version = checkVersions();
  checkOptInDefaults();
  checkReviewCopy();
  checkStandaloneExtractSurface();

  console.log(`Offline Plugin Hub release checks passed for v${version}`);
  console.log("Offline checks: version parity, opt-in defaults, review copy, Slayer copy, standalone extract surface");
  if (releasePlan) printReleasePlan(version);

  if (livePr) {
    await printLivePrStatus();
    console.log(`Live Plugin Hub release check passed for v${version}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
