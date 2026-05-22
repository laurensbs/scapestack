import { ToolHeader } from "@/components/tool-header";
import { GoalsClient } from "./goals-client";

export const metadata = {
  title: "Untradeable Goal Tracker",
  description: "Paste your bank export — see every untradeable, achievement, and milestone item you've earned, and which ones you're closest to completing."
};

export default function GoalsPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="goals" />
      <GoalsClient />
    </main>
  );
}
