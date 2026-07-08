import { describe, expect, it } from "vitest";
import {
  accountModeImpactNote,
  isIronPlannerAccount,
  isUltimatePlannerAccount,
  normalizeScapestackAccountType,
  plannerAccountTypeLabel,
  resolveAccountMode,
  scapestackAccountTypeLabel,
  scapestackAccountTypeToPlannerType
} from "./account-type";

describe("Scapestack account types", () => {
  it("normalizes unsupported values to normal", () => {
    expect(normalizeScapestackAccountType("ultimate_ironman")).toBe("ultimate_ironman");
    expect(normalizeScapestackAccountType("group_ironman")).toBe("group_ironman");
    expect(normalizeScapestackAccountType("bogus")).toBe("normal");
    expect(normalizeScapestackAccountType(null)).toBe("normal");
  });

  it("maps plugin account types to planner archetypes", () => {
    expect(scapestackAccountTypeToPlannerType("normal")).toBe("regular");
    expect(scapestackAccountTypeToPlannerType("ironman")).toBe("ironman");
    expect(scapestackAccountTypeToPlannerType("hardcore_ironman")).toBe("hardcore");
    expect(scapestackAccountTypeToPlannerType("ultimate_ironman")).toBe("ultimate");
    expect(scapestackAccountTypeToPlannerType("group_ironman")).toBe("group");
    expect(scapestackAccountTypeToPlannerType("hardcore_group_ironman")).toBe("group");
  });

  it("labels group and ultimate variants distinctly", () => {
    expect(scapestackAccountTypeLabel("normal")).toBe("Normal");
    expect(scapestackAccountTypeLabel("ultimate_ironman")).toBe("Ultimate Ironman");
    expect(scapestackAccountTypeLabel("group_ironman")).toBe("Group Ironman");
    expect(scapestackAccountTypeLabel("hardcore_group_ironman")).toBe("Hardcore Group Ironman");
  });

  it("identifies planner iron modes without treating regular accounts as iron", () => {
    expect(plannerAccountTypeLabel("regular")).toBe("Normal");
    expect(plannerAccountTypeLabel("ultimate")).toBe("Ultimate Ironman");
    expect(isIronPlannerAccount("regular")).toBe(false);
    expect(isIronPlannerAccount("ironman")).toBe(true);
    expect(isIronPlannerAccount("hardcore")).toBe(true);
    expect(isIronPlannerAccount("ultimate")).toBe(true);
    expect(isIronPlannerAccount("group")).toBe(true);
    expect(isUltimatePlannerAccount("ultimate")).toBe(true);
    expect(isUltimatePlannerAccount("group")).toBe(false);
  });

  it("resolves plugin account type as detected and lets it win over inferred metadata", () => {
    const mode = resolveAccountMode({
      scapestackAccountType: "ironman",
      plannerAccountType: "regular"
    });

    expect(mode).toMatchObject({
      type: "ironman",
      confidence: "detected",
      source: "scapestack-sync",
      badgeLabel: "Ironman detected"
    });
    expect(mode.planningNote).toContain("Self-source");
  });

  it("marks WOM-only account type as inferred", () => {
    const mode = resolveAccountMode({ plannerAccountType: "group" });

    expect(mode).toMatchObject({
      type: "group",
      confidence: "inferred",
      source: "wom",
      badgeLabel: "Group Ironman inferred"
    });
    expect(mode.planningNote).toContain("group storage is not assumed");
  });

  it("degrades safely when account mode is unknown", () => {
    const mode = resolveAccountMode({});

    expect(mode).toMatchObject({
      type: null,
      confidence: "unknown",
      source: "unknown",
      badgeLabel: "Account mode unknown"
    });
    expect(mode.planningNote).toContain("bank readiness only counts");
    expect(accountModeImpactNote("ultimate")).toContain("bank-ready is not normal readiness");
  });
});
