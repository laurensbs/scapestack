import { permanentRedirect } from "next/navigation";
import { legacyRouteNextHref } from "@/lib/next-intent";

// STRATEGY.md: quest-functionaliteit landt in /next als rec-type, niet als
// aparte tool. /quests blijft als 308 om cached links + Google-results niet
// te breken.
export default function Page() {
  permanentRedirect(legacyRouteNextHref("quests"));
}
