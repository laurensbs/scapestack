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

describe("external link security", () => {
  it("pairs every literal target blank link with noopener noreferrer", () => {
    const unsafeLinks = tsxFiles(join(process.cwd(), "src")).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");

      return lines.flatMap((line, index) => {
        if (!line.includes('target="_blank"')) return [];
        const linkBlock = lines.slice(Math.max(0, index - 8), index + 8).join("\n");
        return linkBlock.includes('rel="noopener noreferrer"') ? [] : [`${file}:${index + 1}`];
      });
    });

    expect(unsafeLinks).toEqual([]);
  });
});
