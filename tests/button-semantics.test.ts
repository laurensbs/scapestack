import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("button semantics", () => {
  it("keeps every TSX button explicit about submit vs action behavior", () => {
    const missingType = tsxFiles(join(process.cwd(), "src")).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");

      return lines.flatMap((line, index) => {
        if (!line.includes("<button")) return [];
        const tag = lines.slice(index, index + 7).join("\n");
        const hasExplicitType =
          /type=(["'])button\1/.test(tag) ||
          /type=(["'])submit\1/.test(tag) ||
          tag.includes("type={");

        return hasExplicitType ? [] : [`${file}:${index + 1}`];
      });
    });

    expect(missingType).toEqual([]);
  });
});
