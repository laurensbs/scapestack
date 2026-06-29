import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

describe("boss detail modal affordance", () => {
  it("exposes boss setup details as a named and described dialog", () => {
    expect(source).toContain('const titleId = "boss-modal-title";');
    expect(source).toContain('const descriptionId = "boss-modal-description";');
    expect(source).toContain('const statsId = "boss-modal-stats";');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("aria-describedby={`${descriptionId} ${statsId}`}");
    expect(source).toContain("id={titleId}");
    expect(source).toContain("id={descriptionId}");
    expect(source).toContain("<section id={statsId}>");
  });

  it("labels close controls with the active boss name", () => {
    expect(source).toContain("aria-label={`Close ${boss.name} boss setup details`}");
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toContain('aria-label="Close"');
  });

  it("keeps the boss modal grounded in owned-bank setup copy", () => {
    expect(source).toContain("Best style with your gear");
    expect(source).toContain("Best setup");
    expect(source).toContain("Upgrades you don&apos;t have");
    expect(source).toContain("Bright chips = you have it");
  });
});
