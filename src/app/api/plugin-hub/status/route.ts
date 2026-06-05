import { getPluginHubStatus } from "@/lib/plugin-hub-status";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const status = await getPluginHubStatus();

  return Response.json(status, {
    headers: {
      "cache-control": "s-maxage=300, stale-while-revalidate=600"
    }
  });
}
