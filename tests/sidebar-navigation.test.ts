import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/sidebar.tsx"), "utf8");

describe("sidebar navigation", () => {
  it("labels the sidebar nav and each live tool link as explicit navigation", () => {
    expect(source).toContain('aria-label="Scapestack sidebar tools"');
    expect(source).toContain('aria-label={`${tool.navLabel ?? tool.name}: ${tool.short}`}');
    expect(source).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps mobile drawer controls as non-submit buttons", () => {
    expect(source).toContain('<button\n          type="button"\n          onClick={() => setMobileOpen((v) => !v)}');
    expect(source).toContain('<button\n          type="button"\n          onClick={() => setMobileOpen(false)}');
  });

  it("marks unavailable sidebar tools as intentionally disabled if they return", () => {
    expect(source).toContain('aria-disabled="true"');
    expect(source).toContain('title={`${tool.name} — ${tool.status === "soon" ? "Coming soon" : "Planned"}`}');
  });
});
