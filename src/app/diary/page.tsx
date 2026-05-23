import { permanentRedirect } from "next/navigation";

// STRATEGY.md: diary-recs zitten in /next; geen aparte tracker. 308 om
// oude links netjes door te leiden.
export default function Page() {
  permanentRedirect("/next");
}
