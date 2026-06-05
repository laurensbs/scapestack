import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existingClaim: false,
  hiscores: "found" as "found" | "missing" | "unreachable",
  records: [] as Array<{ rsn: string; token: string }>,
  recordResult: { ok: true } as { ok: boolean; reason?: string; existingTokenHash?: string },
  hiscoreChecks: [] as string[]
}));

vi.mock("@/lib/claim-hiscores", () => ({
  checkHiscoresForClaim: async (rsn: string) => {
    state.hiscoreChecks.push(rsn);
    return state.hiscores;
  }
}));

vi.mock("@/lib/sync-auth", () => ({
  extractBearerToken: (value: string | null) => {
    if (!value?.startsWith("Bearer ")) return null;
    return value.slice("Bearer ".length);
  },
  hasExistingClaim: async () => state.existingClaim,
  recordClaim: async (rsn: string, token: string) => {
    state.records.push({ rsn, token });
    return state.recordResult;
  }
}));

const VALID_TOKEN = "11111111-2222-3333-4444-555555555555";

function claimRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("http://local.test/api/sync/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${VALID_TOKEN}`,
      ...headers
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

async function loadRoute() {
  return await import("@/app/api/sync/claim/route");
}

beforeEach(() => {
  state.existingClaim = false;
  state.hiscores = "found";
  state.records = [];
  state.recordResult = { ok: true };
  state.hiscoreChecks = [];
  vi.resetModules();
});

describe("POST /api/sync/claim", () => {
  it("accepts a new claim and reports hiscores status", async () => {
    const { POST } = await loadRoute();
    const response = await POST(claimRequest({
      rsn: " Lynx Titan "
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.hiscoreChecks).toEqual(["Lynx Titan"]);
    expect(state.records).toEqual([{ rsn: "Lynx Titan", token: VALID_TOKEN }]);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      player: { rsn: "lynx titan", displayName: "Lynx Titan" },
      claim: { status: "accepted", hiscores: "found" }
    });
  });

  it("skips hiscores for existing claims", async () => {
    state.existingClaim = true;
    const { POST } = await loadRoute();
    const response = await POST(claimRequest({
      rsn: "Lynx Titan"
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.hiscoreChecks).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      claim: { status: "verified-existing", hiscores: "skipped-existing" }
    });
  });

  it("rejects RSNs missing from hiscores without recording", async () => {
    state.hiscores = "missing";
    const { POST } = await loadRoute();
    const response = await POST(claimRequest({
      rsn: "Missing"
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.records).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "RSN not found on Hiscores"
    });
  });

  it("returns conflict for a rival token claim", async () => {
    state.existingClaim = true;
    state.recordResult = {
      ok: false,
      reason: "RSN already claimed by another install",
      existingTokenHash: "abc"
    };
    const { POST } = await loadRoute();
    const response = await POST(claimRequest({
      rsn: "Lynx Titan"
    }));

    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "RSN already claimed by another install"
    });
  });

  it("uses the same RSN character rules as sync", async () => {
    const { POST } = await loadRoute();
    const response = await POST(claimRequest({
      rsn: "bad/name"
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.hiscoreChecks).toEqual([]);
    expect(state.records).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      error: "rsn contains invalid characters"
    });
  });

  it("rejects non-object JSON bodies", async () => {
    const { POST } = await loadRoute();
    const response = await POST(claimRequest("[]"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "JSON body must be an object"
    });
  });

  it("requires the install token in Authorization instead of the claim JSON body", async () => {
    const { POST } = await loadRoute();
    const response = await POST(claimRequest(
      {
        rsn: "Lynx Titan",
        token: VALID_TOKEN
      },
      { authorization: "" }
    ));

    expect(response.status).toBe(401);
    expect(state.records).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Missing or malformed Authorization header"
    });
  });

  it("rejects oversized declared or actual bodies", async () => {
    const { POST } = await loadRoute();
    const declared = await POST(claimRequest("{}", { "content-length": "50001" }));
    expect(declared.status).toBe(400);
    await expect(declared.json()).resolves.toMatchObject({ error: "Body too large" });

    const actual = await POST(claimRequest(`{"rsn":"${"A".repeat(50_001)}"}`));
    expect(actual.status).toBe(400);
    await expect(actual.json()).resolves.toMatchObject({ error: "Body too large" });
  });

  it("returns CORS preflight headers for Authorization", async () => {
    const { OPTIONS } = await loadRoute();
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
