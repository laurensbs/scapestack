import { describe, expect, it } from "vitest";
import { requestHasTrustedOrigin } from "@/lib/account-session-cookie";

describe("account session request origin", () => {
  it("accepts same-origin and non-browser server calls", () => {
    expect(requestHasTrustedOrigin(new Request("https://www.scapestack.org/api/account/delete", {
      headers: { host: "www.scapestack.org", origin: "https://www.scapestack.org" }
    }))).toBe(true);
    expect(requestHasTrustedOrigin(new Request("https://www.scapestack.org/api/account/delete", {
      headers: { host: "www.scapestack.org" }
    }))).toBe(true);
  });

  it("rejects malformed or cross-origin browser calls", () => {
    expect(requestHasTrustedOrigin(new Request("https://www.scapestack.org/api/account/delete", {
      headers: { host: "www.scapestack.org", origin: "https://evil.example" }
    }))).toBe(false);
    expect(requestHasTrustedOrigin(new Request("https://www.scapestack.org/api/account/delete", {
      headers: { host: "www.scapestack.org", origin: "not a url" }
    }))).toBe(false);
  });
});
