import { ToolHeader } from "@/components/tool-header";
import { GoalsClient } from "./goals-client";

export const metadata = {
  title: "What unlock next?",
  description: "Find the closest useful quest, diary, cape, gear unlock or account milestone."
};

export default function GoalsPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="goals" />
      <GoalsClient />
    </main>
  );
}
