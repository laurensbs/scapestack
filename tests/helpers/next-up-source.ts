// Several guard tests assert on the *text* of the /next engine rather than on
// its behaviour — cheap protection against copy or tuning regressions that a
// unit test would not catch.
//
// Those guards used to read src/lib/next-up.ts directly, which meant splitting
// the engine into modules broke them even though nothing changed. Reading the
// whole next-up* family keeps the guard about the engine, not about which file
// a function happens to live in today.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LIB_DIR = join(process.cwd(), "src/lib");

/** Every module the /next engine is split across, path-sorted for stability. */
export function nextUpSourceFiles(): string[] {
  return readdirSync(LIB_DIR)
    .filter((name) => /^next-up(-[a-z-]+)?\.ts$/.test(name))
    .sort()
    .map((name) => join(LIB_DIR, name));
}

/** All engine source concatenated — use for `toContain` / `not.toContain`. */
export function nextUpSource(): string {
  return nextUpSourceFiles()
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

/** Total line count across the engine, for size guardrails. */
export function nextUpLineCount(): number {
  return nextUpSource().split(/\r?\n/).length;
}
