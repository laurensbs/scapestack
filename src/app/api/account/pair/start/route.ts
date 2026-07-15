import { NextResponse } from "next/server";
import { startAccountPairing } from "@/lib/account-pairing";

const RSN_RE = /^[A-Za-z0-9 _-]+$/;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const rsn = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { rsn?: unknown }).rsn
    : null;
  if (typeof rsn !== "string" || rsn.trim().length < 1 || rsn.trim().length > 12 || !RSN_RE.test(rsn.trim())) {
    return NextResponse.json({ ok: false, error: "Enter a valid OSRS name" }, { status: 400 });
  }
  const pairing = await startAccountPairing(rsn);
  if (pairing.status === "unclaimed") {
    return NextResponse.json({
      ok: false,
      error: "Sync this player from RuneLite before connecting another browser"
    }, { status: 409 });
  }
  if (pairing.status === "rate-limited") {
    return NextResponse.json({ ok: false, error: "Wait a minute before creating another code" }, {
      status: 429,
      headers: { "cache-control": "no-store", "retry-after": "60" }
    });
  }
  return NextResponse.json({ ok: true, pairing }, {
    headers: { "cache-control": "no-store" }
  });
}
