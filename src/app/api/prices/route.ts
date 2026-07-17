import { NextResponse } from "next/server";
import { getPriceSnapshot, priceFor } from "@/lib/prices";

export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = [...new Set(
    (searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => Math.abs(Number(value)))
      .filter((value) => Number.isSafeInteger(value) && value > 0)
  )].slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Provide one or more numeric item ids." }, { status: 400 });
  }

  const snapshot = await getPriceSnapshot();
  const values = Object.fromEntries(ids.map((id) => [String(id), priceFor(snapshot.prices, id)]));
  return NextResponse.json({
    values,
    sourceUrl: snapshot.sourceUrl,
    retrievedAt: snapshot.retrievedAt,
    freshness: snapshot.freshness,
    fallbackUsed: snapshot.fallbackUsed
  }, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" }
  });
}
