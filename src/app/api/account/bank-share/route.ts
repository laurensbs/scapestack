import { NextResponse } from "next/server";
import { getConnectedAccount } from "@/lib/account-pairing";
import { readAccountSessionToken, requestHasTrustedOrigin } from "@/lib/account-session-cookie";
import {
  createPrivateBankShare,
  publishBankShare,
  unpublishBankShare
} from "@/lib/bank-share-repo";

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

async function shareIdFrom(request: Request): Promise<{ shareId: string; publish?: boolean } | null> {
  try {
    const body = await request.json() as { shareId?: unknown; publish?: unknown };
    return typeof body.shareId === "string"
      ? { shareId: body.shareId, publish: body.publish === true }
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const originError = rejectOrigin(request);
  if (originError) return originError;
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite before creating a bank image" }, 401);
  try {
    const result = await createPrivateBankShare(account);
    if (result.status !== "created") {
      const error = result.status === "no-bank"
        ? "Sync an opened bank before creating an image"
        : result.status === "iron-account"
          ? "GE affordability images are not available for Ironman banks"
          : "No priced set answer is available to share";
      return json({ ok: false, error }, 409);
    }
    return json({
      ok: true,
      share: { shareId: result.shareId, state: "private", snapshot: result.snapshot }
    }, 201);
  } catch (error) {
    console.error("Private bank share creation failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not create the private image" }, 500);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const originError = rejectOrigin(request);
  if (originError) return originError;
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite before publishing a bank image" }, 401);
  const body = await shareIdFrom(request);
  if (!body?.publish) {
    return json({ ok: false, error: "Confirm this image should be public" }, 400);
  }
  try {
    const published = await publishBankShare(account.accountId, body.shareId);
    return published
      ? json({ ok: true, share: { ...published, state: "public" } })
      : json({ ok: false, error: "That private image was not found" }, 404);
  } catch (error) {
    console.error("Bank share publication failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not publish the image" }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const originError = rejectOrigin(request);
  if (originError) return originError;
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite before changing a bank image" }, 401);
  const body = await shareIdFrom(request);
  if (!body) return json({ ok: false, error: "That image link is not valid" }, 400);
  try {
    const unpublished = await unpublishBankShare(account.accountId, body.shareId);
    return unpublished
      ? json({ ok: true, share: { shareId: body.shareId, state: "private" } })
      : json({ ok: false, error: "That public image was not found" }, 404);
  } catch (error) {
    console.error("Bank share removal failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not make the image private" }, 500);
  }
}
