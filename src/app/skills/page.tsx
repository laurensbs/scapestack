import { permanentRedirect } from "next/navigation";

// STRATEGY.md: skill-milestones zijn een rec-type in /next, geen aparte
// planner. /skills blijft als 308 zodat cached links niet 404'en.
export default function Page() {
  permanentRedirect("/next");
}
