import { permanentRedirect } from "next/navigation";

// STRATEGY.md (mei 2026) schrapte de GP Tracker — Wiki Prices + ge-tracker.com
// doen dit beter. We sturen cached external links door naar /next zodat ze
// geen 404 raken. Permanent (308) zodat zoekmachines de oude URL afscheiden.
export default function Page() {
  permanentRedirect("/next");
}
