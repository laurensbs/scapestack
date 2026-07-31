import { NextResponse } from "next/server";
import { getConnectedAccount } from "@/lib/account-pairing";
import {
  deleteAccountPinnedGoal,
  getAccountPinnedGoals,
  upsertAccountPinnedGoal
} from "@/lib/account-pinned-goals-repo";
import { readAccountSessionToken, requestHasTrustedOrigin } from "@/lib/account-session-cookie";

const NO_STORE = { "cache-control": "no-store" };

function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function accountFor(request: Request) {
  const token = readAccountSessionToken(request);
  return token ? getConnectedAccount(token) : null;
}

function rejectOrigin(request: Request): Response | null {
  return requestHasTrustedOrigin(request)
    ? null
    : json({ ok: false, error: "That request did not come from this site" }, 403);
}

export async function GET(request: Request): Promise<Response> {
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite to load goals from another device" }, 401);
  try {
    const goals = await getAccountPinnedGoals(account.accountId);
    return json({ ok: true, goals });
  } catch (error) {
    console.error("Pinned goals read failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not load your goals" }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const originError = rejectOrigin(request);
  if (originError) return originError;
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite to save goals across devices" }, 401);
  let goal: unknown;
  try {
    goal = (await request.json() as { goal?: unknown }).goal;
  } catch {
    return json({ ok: false, error: "That goal is not valid" }, 400);
  }
  try {
    const saved = await upsertAccountPinnedGoal(account.accountId, goal);
    return saved
      ? json({ ok: true, goal: saved }, 201)
      : json({ ok: false, error: "That goal is not valid" }, 400);
  } catch (error) {
    console.error("Pinned goal write failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not save that goal" }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const originError = rejectOrigin(request);
  if (originError) return originError;
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite to remove synced goals" }, 401);
  let key: string | null = null;
  try {
    const body = await request.json() as { key?: unknown };
    key = typeof body.key === "string" ? body.key : null;
  } catch {
    return json({ ok: false, error: "That goal is not valid" }, 400);
  }
  if (!key) return json({ ok: false, error: "That goal is not valid" }, 400);
  try {
    const deleted = await deleteAccountPinnedGoal(account.accountId, key);
    return deleted
      ? json({ ok: true, key })
      : json({ ok: false, error: "That saved goal was not found" }, 404);
  } catch (error) {
    console.error("Pinned goal delete failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not remove that goal" }, 500);
  }
}
