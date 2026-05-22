import { ToolHeader } from "@/components/tool-header";
import { DpsClient } from "./dps-client";

export const metadata = {
  title: "DPS Calculator",
  description: "Paste your bank — get the best gear setup and DPS for every boss, plus the top upgrades that would speed up your kills."
};

export default function DpsPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="dps" />
      <DpsClient />
    </main>
  );
}
