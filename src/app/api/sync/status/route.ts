import { NextResponse } from "next/server";
import { pluginSyncReceipt } from "@/lib/plugin-sync-receipt";
import { getSyncedPlayer } from "@/lib/sync-repo";

const RSN_RE = /^[A-Za-z0-9 _-]+$/;
const HEADERS = {
  "cache-control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

export async function GET(request: Request): Promise<Response> {
  const rsn = new URL(request.url).searchParams.get("rsn")?.trim() ?? "";
  if (!rsn || rsn.length > 12 || !RSN_RE.test(rsn)) {
    return NextResponse.json({ ok: false, error: "Enter a valid OSRS name" }, { status: 400, headers: HEADERS });
  }
  const player = await getSyncedPlayer(rsn);
  if (!player) {
    return NextResponse.json({ ok: false, status: "missing", rsn }, { status: 404, headers: HEADERS });
  }
  return NextResponse.json({ ok: true, status: "found", player: pluginSyncReceipt(player) }, { headers: HEADERS });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: HEADERS });
}
