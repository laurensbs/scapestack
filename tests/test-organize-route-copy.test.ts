import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/api/test-organize/route.ts"), "utf8");

describe("test organize smoke endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns import warnings for runtime verification", () => {
    expect(source).toContain("importWarnings: result.importWarnings");
  });

  it("is explicitly disabled in production unless opted in", () => {
    expect(source).toContain('process.env.NODE_ENV !== "production"');
    expect(source).toContain('process.env.SCAPESTACK_ENABLE_TEST_ORGANIZE === "1"');
    expect(source).toContain('status: 404');
    expect(source).toContain('"cache-control": "no-store"');
  });

  it("returns 404 in production by default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCAPESTACK_ENABLE_TEST_ORGANIZE", "");
    const { POST } = await import("@/app/api/test-organize/route");

    const response = await POST(new Request("http://local.test/api/test-organize", {
      method: "POST",
      body: "banktags,1,test,4151"
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ ok: false, error: "Not found" });
  });

  it("still works for explicit local smoke verification", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCAPESTACK_ENABLE_TEST_ORGANIZE", "1");
    const { POST } = await import("@/app/api/test-organize/route");

    const response = await POST(new Request("http://local.test/api/test-organize", {
      method: "POST",
      body: "banktags,1,test,4151,4151,995"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.importWarnings).toMatchObject({
      parsedItemCount: 2,
      duplicateItemCount: 0
    });
  });
});
