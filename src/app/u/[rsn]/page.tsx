import { redirect } from "next/navigation";
import { playerPath } from "@/lib/player-route";

export default async function LegacyPlayerProfile({
  params
}: {
  params: Promise<{ rsn: string }>;
}) {
  const { rsn } = await params;
  redirect(playerPath(decodeURIComponent(rsn)));
}
