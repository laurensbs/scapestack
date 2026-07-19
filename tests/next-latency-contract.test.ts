import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
const nextClient = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
const wom = readFileSync(join(process.cwd(), "src/lib/wom.ts"), "utf8");
const temple = readFileSync(join(process.cwd(), "src/lib/temple.ts"), "utf8");
const collectionLog = readFileSync(join(process.cwd(), "src/lib/collection-log.ts"), "utf8");

describe("first plan latency contract", () => {
  it("has no deliberate loader floor and reads account context in one call", () => {
    expect(nextClient).toContain("planningContextAction(rsn)");
    expect(nextClient).toContain("planningContext?.initialPlan");
    expect(nextClient).not.toContain("minLoaderUntil");
    expect(nextClient).not.toContain("minimum loader");
    expect(nextClient).not.toMatch(/remainingLoaderMs[\s\S]*setTimeout/);
  });

  it("bounds critical and optional sources independently", () => {
    expect(actions).toContain("scapestack: 650");
    expect(actions).toContain("hiscores: 900");
    expect(actions).toContain("wom: 300");
    expect(actions).toContain("temple: 300");
    expect(actions).toContain("collectionLog: 300");
    expect(actions).toContain('runBoundedSource("scapestack"');
    expect(actions).toContain('runBoundedSource("hiscores"');
    expect(actions).toContain('runBoundedSource("collection_log"');
  });

  it("passes abort signals to every optional HTTP source", () => {
    for (const source of [wom, temple, collectionLog]) {
      expect(source).toContain("signal?: AbortSignal");
      expect(source).toContain("signal: options.signal");
    }
  });

  it("records only privacy-safe duration data", () => {
    expect(actions).toContain('console.info("scapestack.next_context", JSON.stringify(timing))');
    expect(actions).toContain("plannerMs");
    expect(nextClient).toContain('track("plan:context_ready"');
  });

  it("keeps homepage HTML and its client bundle on one static deployment", () => {
    expect(home).toContain('export const dynamic = "force-static";');
    expect(home).not.toContain("export const revalidate");
  });
});
