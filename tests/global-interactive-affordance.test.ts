import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("global interactive affordance CSS", () => {
  it("keeps clickable elements visibly interactive by default", () => {
    expect(globalsCss).toContain("Global interactive affordance");
    expect(globalsCss).toContain(":where(button:not(:disabled), a[href], summary, label[for], select:not(:disabled))");
    expect(globalsCss).toContain("cursor: pointer;");
  });

  it("gives actions keyboard and active feedback", () => {
    expect(globalsCss).toContain(":where(button:not(:disabled), a[href], summary):active");
    expect(globalsCss).toContain("transform: translateY(1px);");
    expect(globalsCss).toContain(":where(button:not(:disabled), a[href]):focus-visible");
    expect(globalsCss).toContain(":where(input, textarea, select, summary):focus-visible");
    expect(globalsCss).toContain("box-shadow: 0 0 0 3px rgba(200, 154, 61, 0.12);");
  });

  it("keeps unstyled content links recognizable", () => {
    expect(globalsCss).toContain(":where(a[href]:not([class]))");
    expect(globalsCss).toContain("text-decoration-line: underline;");
    expect(globalsCss).toContain("text-underline-offset: 3px;");
  });

  it("makes disabled actions feel unavailable", () => {
    expect(globalsCss).toContain(":where(button:disabled, select:disabled, [aria-disabled=\"true\"])");
    expect(globalsCss).toContain(":where(button:disabled, [aria-disabled=\"true\"])");
    expect(globalsCss).toContain("opacity: 0.55;");
  });
});
