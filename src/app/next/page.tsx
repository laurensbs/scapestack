import { ToolHeader } from "@/components/tool-header";
import { NextClient } from "./next-client";

export const metadata = {
  title: "What to do now",
  description: "Stuck in OSRS? Paste your bank and look up your stats — get a clear, ranked list of what's worth doing next, tuned to your account."
};

export default function NextPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="next" />
      <NextClient />
    </main>
  );
}
