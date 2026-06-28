import { ToolHeader } from "@/components/tool-header";
import { SlayerClient } from "./slayer-client";

export const metadata = {
  title: "Task Check",
  description: "Decide whether this Slayer task is worth killing, skipping, extending, bursting or cannoning."
};

export default function SlayerPage() {
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 py-7 pb-20">
      <ToolHeader slug="slayer" />
      <SlayerClient />
    </main>
  );
}
