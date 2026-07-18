#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const livePublished = args.has("--live") || args.has("--live-pr");
const releasePlan = args.has("--plan");
const jsonOutput = args.has("--json");
const defaultStandaloneDir = `${process.env.HOME ?? ""}/code/scapestack-runelite-plugin`;
const releaseManifestPath = "plugin/release-manifest.json";
const canonicalReleaseManifest = JSON.parse(readFileSync(join(root, releaseManifestPath), "utf8"));

function read(path) {
  return readFileSync(`${root}/${path}`, "utf8");
}

function fail(message) {
  throw new Error(message);
}

function validateReleaseManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1) fail("Unsupported plugin release manifest schema");
  if (!/^[a-z0-9-]+$/.test(manifest.pluginId ?? "")) fail("Invalid pluginId in release manifest");
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(manifest.repository ?? "")) {
    fail("Invalid standalone repository in release manifest");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.candidate?.version ?? "")) fail("Invalid candidate version in release manifest");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.published?.version ?? "")) fail("Invalid published version in release manifest");
  if (!/^[a-f0-9]{40}$/.test(manifest.published?.sourceCommit ?? "")) fail("Invalid published sourceCommit in release manifest");
  if (!Number.isInteger(manifest.candidate?.contractVersion) || manifest.candidate.contractVersion < 1) {
    fail("Invalid candidate contractVersion in release manifest");
  }
  if (!Number.isInteger(manifest.published?.contractVersion) || manifest.published.contractVersion < 1) {
    fail("Invalid published contractVersion in release manifest");
  }
  if (!Number.isInteger(manifest.candidate?.minimumWebsiteContractVersion)
    || manifest.candidate.minimumWebsiteContractVersion < 1) {
    fail("Invalid minimumWebsiteContractVersion in release manifest");
  }
  if (manifest.candidate?.runeLiteDependency !== "latest.release") {
    fail("RuneLite dependency must follow the official Plugin Hub latest.release guidance");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.candidate?.verifiedRuneLiteRelease ?? "")) {
    fail("Invalid verifiedRuneLiteRelease in release manifest");
  }
  return manifest;
}

function rootGitArgs(args) {
  return existsSync(join(root, ".repo-git"))
    ? ["--git-dir=.repo-git", "--work-tree=.", ...args]
    : args;
}

function rootGit(args) {
  return execFileSync("git", rootGitArgs(args), { cwd: root, encoding: "utf8" }).trim();
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
  "src/lib/sync-service-readiness.ts",
  "src/app/plugin/",
  "src/app/api/sync/",
  "src/components/plugin-",
  "scripts/print-plugin-review-packet.ts",
  "scripts/check-plugin-release.mjs",
  "scripts/extract-plugin.sh",
  "package.json",
  "tests/plugin-",
  "tests/sync-"
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
      || path === "src/lib/sync-service-readiness.ts"
      || path.startsWith("src/app/api/sync/")
  },
  {
    label: "Release tooling/tests",
    matches: (path) => path.startsWith("scripts/")
      || path.startsWith("tests/plugin-")
      || path.startsWith("tests/sync-")
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
    const output = rootGit(["status", "--short"]);
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

function lockedRuneLiteVersions() {
  const lock = read("plugin/gradle.lockfile");
  return [...lock.matchAll(/^net\.runelite:(?:client|injected-client|jshell|runelite-api):([^=]+)=/gm)]
    .map((match) => match[1]);
}

function checkVersions(manifest) {
  const expected = manifest.candidate.version;
  const versions = {
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

  expectContains("src/lib/plugin-sync.ts", 'import releaseManifest from "../../plugin/release-manifest.json"');
  expectContains("src/lib/plugin-sync.ts", "releaseManifest.candidate.version");
  expectContains("src/lib/plugin-sync.ts", "releaseManifest.published.version");
  expectContains("src/lib/plugin-hub-status.ts", "releaseManifest.reviewPullRequest");
  expectContains("plugin/build.gradle", "candidateRelease.version");
  expectContains("plugin/build.gradle", "candidateRelease.runeLiteDependency");
  expectContains("plugin/build.gradle", "lockAllConfigurations()");

  const locked = lockedRuneLiteVersions();
  if (locked.length === 0) fail("plugin/gradle.lockfile does not lock RuneLite dependencies");
  for (const version of locked) {
    if (version !== manifest.candidate.verifiedRuneLiteRelease) {
      fail(`RuneLite lock is ${version}, expected ${manifest.candidate.verifiedRuneLiteRelease}`);
    }
  }

  return {
    version: expected,
    contractVersion: manifest.candidate.contractVersion,
    minimumWebsiteContractVersion: manifest.candidate.minimumWebsiteContractVersion,
    runeLiteDependency: manifest.candidate.runeLiteDependency,
    verifiedRuneLiteRelease: manifest.candidate.verifiedRuneLiteRelease
  };
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
    expectContains(path, "Sync on login");
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
  expectContains("plugin/PUBLISHING.md", "plugin/release-manifest.json");
  expectContains("plugin/PUBLISHING.md", "npm run plugin:release-evidence");
  expectContains("plugin/PUBLISHING.md", "Plugin Hub master");
  expectContains("src/app/plugin/page.tsx", "Bank can be turned off");
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
    /^gradle\.lockfile$/,
    /^gradlew$/,
    /^gradlew\.bat$/,
    /^runelite-plugin\.properties$/,
    /^release-manifest\.json$/,
    /^gradle\/wrapper\/gradle-wrapper\.(jar|properties)$/,
    /^src\/main\/java\/app\/scapestack\/runelite\/[A-Za-z0-9_$]+\.java$/,
    /^src\/test\/java\/app\/scapestack\/runelite\/[A-Za-z0-9_$]+\.java$/,
    /^src\/test\/resources\/fixtures\/plugin-sync-v3\.json$/
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

export function parsePluginHubManifest(text) {
  if (typeof text !== "string" || !text.trim()) fail("Plugin Hub master manifest is empty");
  const values = Object.fromEntries(text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
  if (!values.repository) fail("Plugin Hub master manifest is missing repository");
  if (!/^[a-f0-9]{40}$/.test(values.commit ?? "")) fail("Plugin Hub master manifest has an invalid commit");
  return {
    repository: values.repository,
    commit: values.commit,
    warning: values.warning ?? null
  };
}

export function pluginVersionFromProperties(text) {
  const version = typeof text === "string" ? text.match(/^version=(.+)$/m)?.[1]?.trim() : null;
  if (!version) fail("Pinned standalone runelite-plugin.properties has no version");
  return version;
}

function normalizedRepository(value) {
  return String(value ?? "").trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

export function comparePublishedRelease(manifest, state) {
  const failures = [];
  const warnings = [];
  const published = manifest.published;

  if (normalizedRepository(state.hubRepository) !== normalizedRepository(manifest.repository)) {
    failures.push(`Plugin Hub repository is ${state.hubRepository || "missing"}, expected ${manifest.repository}`);
  }
  if (state.hubCommit !== published.sourceCommit) {
    failures.push(`Plugin Hub master pin is ${state.hubCommit || "missing"}, expected published source ${published.sourceCommit}`);
  }
  if (state.pinnedVersion !== published.version) {
    failures.push(`Pinned standalone version is ${state.pinnedVersion || "missing"}, expected published v${published.version}`);
  }
  if (state.officialRuneLiteRelease !== manifest.candidate.verifiedRuneLiteRelease) {
    failures.push(`Official RuneLite release is ${state.officialRuneLiteRelease || "unknown"}, lock verifies ${manifest.candidate.verifiedRuneLiteRelease}`);
  }

  let standaloneState = "published-current";
  if (state.standaloneHead && state.standaloneHead !== published.sourceCommit) {
    if (state.standaloneMainVersion === manifest.candidate.version) {
      standaloneState = "candidate-ahead";
      warnings.push(`Standalone main has candidate v${state.standaloneMainVersion} at ${state.standaloneHead}`);
    } else {
      failures.push(`Standalone main ${state.standaloneHead} has untracked version ${state.standaloneMainVersion || "unknown"}`);
    }
  } else if (state.standaloneMainVersion !== published.version) {
    failures.push(`Standalone published head reports v${state.standaloneMainVersion || "unknown"}, expected v${published.version}`);
  }

  return { failures, warnings, standaloneState };
}

function githubRepositoryPath(repository) {
  const match = normalizedRepository(repository).match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/);
  if (!match?.[1]) fail(`Unsupported standalone repository URL: ${repository}`);
  return match[1];
}

async function fetchText(url, label) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "text/plain",
        "user-agent": "scapestack-plugin-release-check"
      }
    });
  } catch (error) {
    fail(`${label} fetch failed (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!response.ok) fail(`${label} fetch failed (${response.status})`);
  return response.text();
}

function standaloneRemoteHead(manifest) {
  const output = execFileSync("git", ["ls-remote", manifest.repository, `refs/heads/${manifest.standaloneBranch}`], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const head = output.split(/\s+/)[0] ?? "";
  if (!/^[a-f0-9]{40}$/.test(head)) fail("Could not resolve standalone main commit");
  return head;
}

function officialRuneLiteRelease(metadata) {
  const release = metadata.match(/<release>([^<]+)<\/release>/)?.[1]?.trim();
  if (!release) fail("Official RuneLite Maven metadata has no release");
  return release;
}

async function informationalPrStatus(manifest) {
  const prNumber = manifest.reviewPullRequest;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "scapestack-plugin-release-check"
  };
  try {
    const response = await fetch(`https://api.github.com/repos/runelite/plugin-hub/pulls/${prNumber}`, { headers });
    if (!response.ok) return { available: false, status: response.status, prNumber };
    const pr = await response.json();
    return {
      available: true,
      prNumber,
      state: pr.merged_at ? "merged" : pr.state ?? "unknown",
      updatedAt: pr.updated_at ?? null,
      reviewCopyIssues: reviewCopyIssuesFromBody(pr.body)
    };
  } catch (error) {
    return {
      available: false,
      status: "fetch-failed",
      prNumber,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkLivePublishedState(manifest) {
  const repositoryPath = githubRepositoryPath(manifest.repository);
  const hubUrl = `https://raw.githubusercontent.com/runelite/plugin-hub/master/${manifest.pluginHubManifestPath}`;
  const hubManifest = parsePluginHubManifest(await fetchText(hubUrl, "Plugin Hub master manifest"));
  const pinnedPropertiesUrl = `https://raw.githubusercontent.com/${repositoryPath}/${hubManifest.commit}/runelite-plugin.properties`;
  const mainPropertiesUrl = `https://raw.githubusercontent.com/${repositoryPath}/${manifest.standaloneBranch}/runelite-plugin.properties`;
  const [pinnedProperties, mainProperties, mavenMetadata, pr] = await Promise.all([
    fetchText(pinnedPropertiesUrl, "Pinned standalone properties"),
    fetchText(mainPropertiesUrl, "Standalone main properties"),
    fetchText("https://repo.runelite.net/net/runelite/client/maven-metadata.xml", "RuneLite Maven metadata"),
    informationalPrStatus(manifest)
  ]);
  const state = {
    hubRepository: hubManifest.repository,
    hubCommit: hubManifest.commit,
    hubWarning: hubManifest.warning,
    pinnedVersion: pluginVersionFromProperties(pinnedProperties),
    standaloneHead: standaloneRemoteHead(manifest),
    standaloneMainVersion: pluginVersionFromProperties(mainProperties),
    officialRuneLiteRelease: officialRuneLiteRelease(mavenMetadata)
  };
  const comparison = comparePublishedRelease(manifest, state);

  return { state, comparison, reviewPr: pr };
}

export function reviewCopyIssuesFromBody(body) {
  if (typeof body !== "string" || !body.trim()) return ["missing PR body"];
  const normalized = body.toLowerCase().replace(/[‐‑‒–—]/g, "-");
  const issues = [];

  if (normalized.includes("sync on login defaults to on")
    || normalized.includes("sync-on-login defaults to on")
    || (normalized.includes("auto") && normalized.includes("defaults to on"))) {
    issues.push("sync-on-login defaults");
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
  const questCompleteDefaultsOff = normalized.includes("refresh after quests defaults off")
    || normalized.includes("sync on quest complete defaults off");
  const questCompleteGated = normalized.includes("quest-complete refresh is also gated behind sync on login")
    || normalized.includes("quest-complete sync is also gated behind sync on login")
    || normalized.includes("quest-complete sync is also gated behind auto-sync on login");
  if (!questCompleteDefaultsOff || !questCompleteGated) {
    issues.push("quest-complete opt-in gate");
  }
  if (!normalized.includes("slayer")) {
    issues.push("Slayer payload");
  }
  if (!normalized.includes("bank") || !normalized.includes("inventory") || !normalized.includes("equipment")) {
    issues.push("bank/inventory/equipment exclusion");
  }
  if (normalized.includes("no bank, inventory or equipment data")
    || normalized.includes("no bank data is sent")
    || (normalized.includes("never sent:") && normalized.includes("bank, inventory"))) {
    issues.push("bank default copy");
  }

  return issues;
}

function printReleasePlan(version) {
  const releaseImpactChanges = localReleaseImpactChanges();
  const standaloneStatus = standaloneReleaseStatus();
  console.log("Release plan:");
  if (releaseImpactChanges.length > 0) {
    console.log(`Local release-impact changes: ${releaseImpactChanges.length} path${releaseImpactChanges.length === 1 ? "" : "s"} must be reconciled before handoff.`);
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
  console.log("7. Update plugin/release-manifest.json only after Plugin Hub master points to the intended published commit.");
  console.log("8. Re-run npm run plugin:release-check:live and verify published and candidate state are reported separately.");
  console.log("9. Save npm run plugin:release-evidence output with the release handoff.");
  console.log("10. Keep the new PR body explicit: sync is opt-in, bank checks send item IDs/names/quantities only, HTTP runs off the client thread.");
}

function printLivePublishedState(live) {
  console.log(`Published Plugin Hub pin: ${live.state.hubCommit}`);
  console.log(`Published standalone artifact: v${live.state.pinnedVersion}`);
  console.log(`Standalone main: v${live.state.standaloneMainVersion} at ${live.state.standaloneHead}`);
  console.log(`Standalone state: ${live.comparison.standaloneState}`);
  console.log(`Verified RuneLite release: ${live.state.officialRuneLiteRelease}`);
  if (live.state.hubWarning) console.log(`Plugin Hub warning: ${live.state.hubWarning}`);
  for (const warning of live.comparison.warnings) console.log(`Release note: ${warning}`);
  if (live.reviewPr.available) {
    console.log(`Historical PR #${live.reviewPr.prNumber}: ${live.reviewPr.state}, updated=${live.reviewPr.updatedAt ?? "unknown"} (informational)`);
    if (live.reviewPr.reviewCopyIssues.length > 0) {
      console.log(`Historical PR copy is stale (${live.reviewPr.reviewCopyIssues.join(", ")}); master state remains authoritative.`);
    }
  } else {
    console.log(`Historical PR #${live.reviewPr.prNumber}: unavailable (${live.reviewPr.status}); informational only.`);
  }
}

async function main() {
  const manifest = validateReleaseManifest(canonicalReleaseManifest);
  const candidate = checkVersions(manifest);
  checkOptInDefaults();
  checkReviewCopy();
  checkStandaloneExtractSurface();

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ok: true,
    authority: {
      manifest: releaseManifestPath,
      published: `runelite/plugin-hub master:${manifest.pluginHubManifestPath}`,
      historicalReviewPullRequest: manifest.reviewPullRequest
    },
    main: {
      commit: rootGit(["rev-parse", "HEAD"]),
      candidate
    },
    published: manifest.published,
    localStandalone: standaloneReleaseStatus(),
    live: null
  };

  if (!jsonOutput) {
    console.log(`Offline Plugin Hub release checks passed for candidate v${candidate.version}`);
    console.log(`Offline contract: v${candidate.contractVersion}, website minimum=${candidate.minimumWebsiteContractVersion}, RuneLite=${candidate.verifiedRuneLiteRelease} locked`);
    console.log("Offline checks: manifest ownership, candidate version parity, dependency lock, opt-in defaults, review copy, standalone extract surface");
  }
  if (releasePlan && !jsonOutput) printReleasePlan(candidate.version);

  if (livePublished) {
    evidence.live = await checkLivePublishedState(manifest);
    if (!jsonOutput) printLivePublishedState(evidence.live);
    if (evidence.live.comparison.failures.length > 0) {
      evidence.ok = false;
      if (jsonOutput) {
        console.log(JSON.stringify(evidence, null, 2));
        process.exitCode = 1;
        return;
      }
      fail(`Live Plugin Hub gate failed: ${evidence.live.comparison.failures.join("; ")}`);
    }
    if (!jsonOutput) {
      console.log(`Live published release check passed for v${manifest.published.version}; candidate v${candidate.version} is tracked separately`);
    }
  }

  if (jsonOutput) console.log(JSON.stringify(evidence, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonOutput) {
      console.log(JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        ok: false,
        error: message
      }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  }
}
