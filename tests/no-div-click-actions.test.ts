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

describe("interactive element semantics", () => {
  it("does not attach click handlers to non-interactive wrappers", () => {
    const offenders = tsxFiles(join(process.cwd(), "src")).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");

      return lines.flatMap((line, index) => {
        const hasWrapperClick = /<(div|span|section|article|li)\b/.test(line) && line.includes("onClick");
        return hasWrapperClick ? [`${file}:${index + 1}`] : [];
      });
    });

    expect(offenders).toEqual([]);
  });

  it("does not reintroduce div-as-button keyboard shims", () => {
    const offenders = tsxFiles(join(process.cwd(), "src")).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('role="button"') ? [file] : [];
    });

    expect(offenders).toEqual([]);
  });
});
