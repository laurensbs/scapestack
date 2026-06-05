import { LOCAL_SYNC_CLAIM_URL, LOCAL_SYNC_URL } from "./plugin-sync-actions";

export interface PluginDevStep {
  label: string;
  title: string;
  code: string;
  body: string;
}

export const PLUGIN_DEV_STEPS: PluginDevStep[] = [
  {
    label: "1",
    title: "Run the web app locally",
    code: "npm run dev -- --hostname 127.0.0.1 --port 4173",
    body: "Use this while developing the sync flow against the local Next API."
  },
  {
    label: "2",
    title: "Point the plugin at local sync",
    code: LOCAL_SYNC_URL,
    body: "Paste this into the plugin's Sync URL setting when running RuneLite from Gradle."
  },
  {
    label: "3",
    title: "Know the claim endpoint",
    code: LOCAL_SYNC_CLAIM_URL,
    body: "The plugin derives this from the Sync URL. Keep it visible while debugging first-claim or 403 recovery."
  },
  {
    label: "4",
    title: "Launch RuneLite with Scapestack loaded",
    code: "cd plugin && ./gradlew runClient",
    body: "This side-loads the plugin via DevLauncher so you can test claim + sync before Plugin Hub approval."
  }
];

export function copyLabelForDevStep(step: PluginDevStep): string {
  if (step.code.startsWith("http://") || step.code.startsWith("https://")) return "Copy URL";
  return "Copy command";
}
