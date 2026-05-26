import { ToolHeader } from "@/components/tool-header";
import { SlayerClient } from "./slayer-client";

export const metadata = {
  title: "Slayer Planner",
  description: "Pick the right master, see expected XP/hour, get a block-list recommendation. Powered by the OSRS Wiki task tables."
};

export default function SlayerPage() {
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 py-7 pb-20">
      <ToolHeader slug="slayer" />
      <SlayerClient />
    </main>
  );
}
