import { permanentRedirect } from "next/navigation";
import { legacyRouteNextHref } from "@/lib/next-intent";

// STRATEGY.md: skill-milestones zijn een rec-type in /next, geen aparte
// planner. /skills blijft als 308 zodat cached links niet 404'en.
export default function Page() {
  permanentRedirect(legacyRouteNextHref("skills"));
}
