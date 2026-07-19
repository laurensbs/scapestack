#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const e2eDatabaseUrl = required("SCAPESTACK_E2E_DATABASE_URL");
const e2eRsn = required("SCAPESTACK_E2E_RSN");
if (process.env.SCAPESTACK_E2E_CONFIRM_ISOLATED !== "1") {
  fail("Set SCAPESTACK_E2E_CONFIRM_ISOLATED=1 after confirming this is a disposable isolated database branch.");
}

const envFile = await readEnvFile(resolve(root, ".env.local"));
const productionDatabaseUrl = process.env.DATABASE_URL || envFile.DATABASE_URL || "";
if (productionDatabaseUrl && databaseIdentity(productionDatabaseUrl) === databaseIdentity(e2eDatabaseUrl)) {
  fail("Refusing cross-system gate because the E2E database resolves to the production DATABASE_URL.");
}

const port = positivePort(process.env.SCAPESTACK_E2E_PORT || "4273");
const baseUrl = `http://127.0.0.1:${port}`;
let server = null;

try {
  console.log("Preparing the isolated sync schema...");
  await run(process.execPath, ["scripts/db-init.mjs"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl }
  });

  console.log(`Starting Scapestack against the isolated branch on ${baseUrl}...`);
  server = spawn(resolve(root, "node_modules/.bin/next"), [
    "dev",
    "--hostname", "127.0.0.1",
    "--port", String(port)
  ], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  await waitForReady(baseUrl, server);
  console.log("Running the real Java serializer -> website -> Neon -> browser readback gate...");
  await run("./gradlew", ["pluginE2e"], {
    cwd: resolve(root, "plugin"),
    env: {
      ...process.env,
      SCAPESTACK_E2E_BASE_URL: baseUrl,
      SCAPESTACK_E2E_DATABASE_URL: e2eDatabaseUrl,
      SCAPESTACK_E2E_RSN: e2eRsn,
      SCAPESTACK_E2E_CONFIRM_ISOLATED: "1"
    }
  });
  console.log("Cross-system gate passed with zero skipped E2E tests.");
} finally {
  await stopServer(server);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function positivePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    fail("SCAPESTACK_E2E_PORT must be an unused port between 1024 and 65535.");
  }
  return port;
}

async function readEnvFile(path) {
  try {
    const text = await readFile(path, "utf8");
    return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) return [];
      return [[match[1], match[2].trim().replace(/^["']|["']$/g, "")]];
    }));
  } catch {
    return {};
  }
}

function databaseIdentity(value) {
  try {
    const url = new URL(value);
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) fail("E2E database must use a PostgreSQL URL.");
    return [url.hostname.toLowerCase(), url.port || "5432", url.pathname, decodeURIComponent(url.username)].join("|");
  } catch {
    fail("E2E database URL is invalid.");
  }
}

function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code ?? signal ?? "unknown"}`));
    });
  });
}

async function waitForReady(base, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before readiness with code ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/api/sync`, { signal: AbortSignal.timeout(2_500) });
      const body = await response.json();
      if (response.ok && body.ready === true && body.database?.ready === true) return;
    } catch {
      // Compilation and the first database connection can take a few seconds.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Scapestack did not become sync-ready within 60 seconds.");
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
