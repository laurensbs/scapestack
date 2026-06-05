export interface DpsUpgradeCopyInput {
  id: number;
  name: string;
  slot: string;
  dpsGain: number;
  scope: string;
  wikiUrl: string;
  geUrl: string;
}

export function buildDpsUpgradeBuyLine(input: DpsUpgradeCopyInput): string {
  return [
    `${input.name} (#${input.id})`,
    `Slot: ${input.slot}`,
    `DPS gain: +${input.dpsGain.toFixed(1)} ${input.scope}`,
    `Wiki: ${input.wikiUrl}`,
    `GE: ${input.geUrl}`
  ].join(" — ");
}
