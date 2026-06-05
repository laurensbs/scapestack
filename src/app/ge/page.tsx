import { permanentRedirect } from "next/navigation";
import { legacyRouteNextHref } from "@/lib/next-intent";

// STRATEGY.md (mei 2026) schrapte de GE Price Tracker — Wiki Prices + de
// RuneLite GE plugin doen dit beter. Cached external links worden naar
// /next geredirect (308, permanent).
export default function Page() {
  permanentRedirect(legacyRouteNextHref("ge"));
}
