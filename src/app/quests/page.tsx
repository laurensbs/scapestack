import { permanentRedirect } from "next/navigation";

// STRATEGY.md: quest-functionaliteit landt in /next als rec-type, niet als
// aparte tool. /quests blijft als 308 om cached links + Google-results niet
// te breken.
export default function Page() {
  permanentRedirect("/next");
}
