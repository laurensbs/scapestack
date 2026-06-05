import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/copy-command.tsx"), "utf8");

describe("CopyCommand fallback UX", () => {
  it("keeps long reviewer packets compact and accessible", () => {
    expect(source).toContain('const longValue = value.length > 120 || value.includes("\\n")');
    expect(source).toContain("max-h-44 overflow-auto whitespace-pre-wrap break-words");
    expect(source).toContain('longValue ? "m-2 w-fit rounded-md border px-3 py-2" : "border-l px-3"');
    expect(source).toContain("aria-label={longValue ? label : `${label}: ${value}`}");
  });

  it("keeps clipboard failures visible because the value is already on-screen", () => {
    expect(source).toContain("Clipboard failed — select the value and copy it manually.");
    expect(source).toContain("Clipboard failed. Select and copy the command manually.");
    expect(source).toContain("state === \"error\"");
    expect(source).not.toContain('setState((current) => current === "error" ? "idle" : current), 2600');
  });
});
