import { ToolHeader } from "@/components/tool-header";
import { GoalsClient } from "./goals-client";

export const metadata = {
  title: "What unlock next?",
  description: "Find the closest useful quest, diary, cape, gear unlock or account milestone."
};

export default function GoalsPage() {
  return (
    <main className="scape-page">
      <ToolHeader slug="goals" />
      <GoalsClient />
    </main>
  );
}
