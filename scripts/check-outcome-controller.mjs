import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTROLLER_PATH = "docs/SCAPESTACK-EXECUTION-CONTROLLER.json";
const REQUIRED_CATEGORY_IDS = [
  "product-promise",
  "first-useful-plan",
  "recommendation-relevance",
  "recommendation-evidence",
  "active-session",
  "long-term-route",
  "return-value",
  "runelite-contract-release",
  "runelite-player-ux",
  "bank-boss-utility",
  "branding",
  "inner-product-ui",
  "mobile-accessibility",
  "performance",
  "measurement",
  "privacy-trust",
  "engineering",
  "reddit-fit"
];

const failures = [];
const checks = [];

const controller = await readJson(CONTROLLER_PATH);
const release = await readJson("plugin/release-manifest.json");
const promptbook = await readText(controller.authoritativePromptbook);
const baseline = await readJson(controller.outcomeArtifact);

check(controller.schemaVersion === 1, "controller schema is v1");
check(
  controller.executionPointer === headerValue(promptbook, "Execution pointer"),
  `controller pointer ${controller.executionPointer} matches the promptbook header`
);
check(
  headerValue(promptbook, "Status") === "active execution controller",
  "authoritative promptbook is the active execution controller"
);
check(
  phaseStatus(promptbook, controller.executionPointer) !== null,
  `execution pointer ${controller.executionPointer} resolves to a phase status`
);

const promptbookFiles = (await readdir(path.join(ROOT, "docs")))
  .filter((name) => /PROMPTBOOK.*\.md$/i.test(name))
  .map((name) => `docs/${name}`);
const activeControllers = [];
for (const file of promptbookFiles) {
  const source = await readText(file);
  if (headerValue(source, "Status") === "active execution controller") activeControllers.push(file);
}
check(
  activeControllers.length === 1 && activeControllers[0] === controller.authoritativePromptbook,
  `only ${controller.authoritativePromptbook} is active (found: ${activeControllers.join(", ") || "none"})`
);

const knownPromptbooks = new Set([
  controller.authoritativePromptbook,
  ...controller.supersededPromptbooks
]);
check(
  promptbookFiles.every((file) => knownPromptbooks.has(file)),
  "every promptbook is authoritative or explicitly superseded"
);

check(
  release.published.version === controller.release.publishedVersion,
  `published plugin version is ${controller.release.publishedVersion}`
);
check(
  release.published.contractVersion === controller.release.contractVersion,
  `published contract is v${controller.release.contractVersion}`
);
check(
  release.published.sourceCommit === controller.release.sourceCommit,
  `Plugin Hub source pin is ${controller.release.sourceCommit}`
);
check(
  promptbook.includes(`Plugin \`${controller.release.publishedVersion}\` is published in Plugin Hub`),
  "authoritative production claim matches the published release"
);

validateBaseline(baseline, controller);

if (failures.length > 0) {
  console.error("Outcome controller audit failed:\n");
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}

console.log("Outcome controller audit passed:\n");
for (const item of checks) console.log(`  - ${item}`);

function validateBaseline(value, currentController) {
  check(value.schemaVersion === 1, "baseline schema is v1");
  check(value.phase === "ODR-00", "baseline belongs to ODR-00");
  check(value.baselineCommit === currentController.baselineCommit, "baseline commit matches controller");
  check(Number.isFinite(Date.parse(value.capturedAt)), "baseline has a valid capture timestamp");
  check(typeof value.launchReady === "boolean", "baseline records launch readiness explicitly");
  check(value.release?.publishedVersion === currentController.release.publishedVersion, "baseline release version is current");
  check(value.release?.contractVersion === currentController.release.contractVersion, "baseline contract is current");
  check(value.release?.sourceCommit === currentController.release.sourceCommit, "baseline Plugin Hub pin is current");
  check(value.release?.pluginHubVerified === true, "baseline records a live Plugin Hub verification");

  const integration = value.gates?.pluginIntegration;
  check(integration?.executed === true, "plugin integration was executed");
  check(integration?.tests > 0, "plugin integration executed at least one test");
  check(integration?.skipped === 0, "plugin integration has zero skipped tests");
  check(integration?.isolatedPersistence === true, "plugin integration used isolated persistence");

  const categories = Array.isArray(value.categories) ? value.categories : [];
  const ids = categories.map((category) => category.id);
  check(
    ids.length === REQUIRED_CATEGORY_IDS.length
      && REQUIRED_CATEGORY_IDS.every((id) => ids.includes(id))
      && new Set(ids).size === ids.length,
    "baseline contains every required category exactly once"
  );

  for (const category of categories) {
    check(
      typeof category.score === "number" && category.score >= 0 && category.score <= 10,
      `${category.id} has a score from 0 to 10`
    );
    check(
      typeof category.target === "number" && category.target >= 0 && category.target <= 10,
      `${category.id} has a target from 0 to 10`
    );
    check(
      category.passed === (category.score >= category.target),
      `${category.id} pass state follows its measured score`
    );
    validateEvidence(category.evidence, category.id);
  }

  for (const [name, gate] of Object.entries(value.gates ?? {})) {
    check(typeof gate.passed === "boolean", `${name} records pass/fail explicitly`);
    check(typeof gate.reason === "string" && gate.reason.trim().length > 0, `${name} records a reason`);
    validateEvidence(gate.evidence, `gate:${name}`);
  }
}

function validateEvidence(evidence, owner) {
  check(Array.isArray(evidence) && evidence.length > 0, `${owner} links evidence`);
  if (!Array.isArray(evidence)) return;
  for (const item of evidence) {
    check(Number.isInteger(item.level) && item.level >= 1 && item.level <= 8, `${owner} evidence has a valid level`);
    check(typeof item.reason === "string" && item.reason.trim().length > 0, `${owner} evidence explains what it proves`);
    check(typeof item.artifact === "string" && item.artifact.trim().length > 0, `${owner} evidence names an artifact`);
    if (typeof item.artifact !== "string" || /^https?:\/\//.test(item.artifact)) continue;
    const artifactPath = item.artifact.split("#", 1)[0];
    check(
      existsSync(path.join(ROOT, artifactPath)),
      `${owner} evidence artifact exists: ${artifactPath}`
    );
  }
}

function headerValue(source, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^${escaped}:\\s*(?:\\\`)?([^\\n\\\`]+)(?:\\\`)?\\s*$`, "mi"));
  return match?.[1]?.trim() ?? null;
}

function phaseStatus(source, phase) {
  const escaped = phase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^## ${escaped}\\b[\\s\\S]{0,500}?^Status:\\s*([^\\n]+)$`, "mi"));
  return match?.[1]?.trim() ?? null;
}

function check(condition, message) {
  if (condition) checks.push(message);
  else failures.push(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}
