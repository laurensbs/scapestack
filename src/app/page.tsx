import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroBossTripPreview } from "@/components/hero-boss-trip-preview";
import { HeroIntake } from "@/components/hero-intake";

export const revalidate = 300;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl overflow-x-hidden px-5 pb-18 pt-10 sm:px-8 sm:pt-14">
      <section className="relative flex min-h-[calc(100vh-6rem)] min-w-0 items-center overflow-hidden">
        <div className="mx-auto grid w-full min-w-0 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-12 lg:gap-y-5">
          <div className="min-w-0 space-y-5 text-center lg:col-start-1 lg:row-start-1 lg:text-left">
            <div
              className="eyebrow"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.02s both" }}
            >
              OSRS trip picker
            </div>
            <h1
              aria-label="Stop bankstanding. Pick the next trip."
              className="mx-auto max-w-[320px] break-words text-[30px] font-semibold leading-[0.98] text-[var(--color-text)] sm:max-w-[820px] sm:text-[62px] lg:mx-0 lg:text-[76px]"
            >
              <span
                className="block text-[var(--color-text)]"
                style={{ animation: "hero-fade 0.65s cubic-bezier(0.22,1,0.36,1) 0.12s both" }}
              >
                Stop bankstanding.
              </span>
              <span
                className="block text-route-gradient"
                style={{
                  animation: "route-shimmer 7s linear 1.8s infinite",
                  backgroundSize: "200% 100%"
                }}
              >
                Pick the next trip.
              </span>
            </h1>

            <p
              className="mx-auto max-w-[610px] text-[16px] leading-[1.6] text-[var(--color-text-secondary)] sm:text-[18px] lg:mx-0"
              style={{
                animation: "hero-mask-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.85s both",
                clipPath: "inset(0 0 100% 0)"
              }}
            >
              Type your OSRS name. Scapestack opens one clean trip and tells you when to stop.
            </p>

          </div>

          <div
            className="relative order-3 mx-auto -my-2 w-full max-w-[240px] sm:max-w-[390px] lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:max-w-[460px]"
            style={{ animation: "hero-boss-in 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
          >
            <HeroBossTripPreview />
          </div>

          <div
            className="order-2 mx-auto w-full max-w-[720px] lg:order-none lg:col-start-1 lg:row-start-2 lg:mx-0"
            style={{ animation: "hero-scale-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.95s both" }}
          >
            <HeroIntake />
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-[var(--color-parchment-edge)]/50 pt-10">
        <div className="osrs-frame scapestack-lock-panel relative mx-auto max-w-3xl animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(200, 154, 61,0.4), transparent)" }}
          />

          <div className="osrs-body relative grid items-center gap-6 p-8 sm:grid-cols-[1fr_auto] sm:p-10">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] font-semibold tracking-normal text-[var(--color-text)] sm:text-[26px]">
                Help keep Scapestack running
              </h3>
              <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-[var(--color-text-dim)]">
                Free, no ads, no account. Coffee keeps the tools online.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <BuyMeCoffee />
              <span className="text-[11px] tracking-wide text-[var(--color-text-muted)]">
                One-time · from €1 · takes 20 seconds
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
