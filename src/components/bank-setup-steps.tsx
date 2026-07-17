import Image from "next/image";
import { cn } from "@/lib/utils";

export const BANK_MEMORY_EXAMPLE = "/intro/step2.png";

export const BANK_SETUP_STEPS = [
  {
    src: "/intro/step1.png",
    title: "1. Install Bank Memory",
    body: "RuneLite Plugin Hub -> Bank Memory."
  },
  {
    src: "/intro/step2.png",
    title: "2. Copy item data",
    body: "Right-click your saved bank and copy item data."
  }
] as const;

interface BankSetupStepsProps {
  className?: string;
  compact?: boolean;
  showBankExample?: boolean;
}

export function BankSetupSteps({ className, compact = false, showBankExample = false }: BankSetupStepsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {showBankExample && (
        <div className="overflow-hidden rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-panel)] sm:col-span-2">
          <div className="relative flex items-center justify-center bg-black p-2">
            <img
              src={BANK_MEMORY_EXAMPLE}
              alt="Bank Memory bank example"
              loading="lazy"
              className="max-h-[180px] w-full rounded-md object-contain"
              onError={(event) => {
                event.currentTarget.src = "/intro/step2.png";
              }}
            />
          </div>
          <div className={compact ? "p-3" : "p-4"}>
            <p className="text-[12.5px] font-bold text-[var(--color-text)] sm:text-[15px]">Your bank in RuneLite</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)] sm:text-[12.5px]">
              Copy the saved bank from Bank Memory, then paste it into Scapestack.
            </p>
          </div>
        </div>
      )}
      {BANK_SETUP_STEPS.map((step) => (
        <div
          key={step.title}
          className={cn(
            "overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]",
            !compact && "rounded-xl"
          )}
        >
          <div className={cn("relative flex items-center justify-center bg-black p-3", compact ? "min-h-[118px]" : "min-h-[150px]")}>
            <Image
              src={step.src}
              alt={step.title}
              width={360}
              height={240}
              sizes="(max-width: 640px) 82vw, 300px"
              className={cn("h-auto w-auto max-w-full", compact ? "max-h-[168px]" : "max-h-[210px]")}
            />
          </div>
          <div className={compact ? "p-3" : "p-4"}>
            <p className="text-[12.5px] font-bold text-[var(--color-text)] sm:text-[15px]">{step.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)] sm:text-[12.5px]">{step.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
