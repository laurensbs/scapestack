import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { HeroIntake } from "@/components/hero-intake";
import { ItemSprite } from "@/components/item-sprite";

export const revalidate = 300;

export default function HomePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
      <section className="grid min-h-[calc(100vh-5rem)] items-start gap-4 lg:grid-cols-[minmax(0,0.98fr)_minmax(340px,0.72fr)] lg:items-center">
        <div className="scapestack-plan-panel p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
            <div>
              <div className="eyebrow text-[var(--color-accent)]">Session board</div>
              <h1 className="mt-1 text-[30px] font-semibold leading-tight text-[var(--color-text)] sm:text-[38px]">
                What can I do now?
              </h1>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="scapestack-status-badge" data-tone="ready">Main move</span>
              <span className="scapestack-status-badge" data-tone="prep">Bank-aware</span>
            </div>
          </div>

          <HeroIntake />

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <SessionSignal icon={9813} label="Quest readiness" value="Near-ready unlocks first" tone="ready" />
            <SessionSignal icon={20594} label="Bank gaps" value="Items only when they change the route" tone="prep" />
            <SessionSignal icon={8007} label="Stop point" value="End on a clean trip or unlock" tone="ready" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="scapestack-board-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow text-[var(--color-accent)]">Routes</div>
                <h2 className="mt-1 text-[22px] font-semibold leading-tight text-[var(--color-text)]">
                  Unlock board
                </h2>
              </div>
              <span className="scapestack-status-badge" data-tone="prep">Blockers</span>
            </div>
            <div className="scapestack-session-list">
              <RoutePreview icon={7462} title="Barrows gloves" detail="Next RFD/prereq blocker first." status="Quest" />
              <RoutePreview icon={772} title="Fairy rings" detail="Priest in Peril + Fairytale gates." status="Travel" />
              <RoutePreview icon={2413} title="Piety" detail="King's Ransom, Prayer, Knight Waves." status="Prayer" />
              <RoutePreview icon={22109} title="Ava's assembler" detail="DS2, head drop and ranged prep." status="Gear" />
              <RoutePreview icon={11864} title="Slayer unlocks" detail="Task, points and level gates." status="Task" />
            </div>
          </div>

          <div className="scapestack-board-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow text-[var(--color-accent)]">Before you go</div>
                <h2 className="mt-1 text-[20px] font-semibold leading-tight text-[var(--color-text)]">
                  Know what to do next
                </h2>
              </div>
              <ItemSprite id={12954} alt="" size={34} />
            </div>
            <ul className="space-y-2 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              <li className="flex gap-2"><span className="text-[var(--color-accent)]">•</span><span>What is blocking this quest or unlock?</span></li>
              <li className="flex gap-2"><span className="text-[var(--color-accent)]">•</span><span>Which items do I still need, and are they in my bank?</span></li>
              <li className="flex gap-2"><span className="text-[var(--color-accent)]">•</span><span>What is a good place to stop this session?</span></li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-[var(--color-parchment-edge)]/50 pt-10">
        <div className="osrs-frame relative mx-auto max-w-3xl animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(200, 154, 61,0.4), transparent)" }}
          />

          <div className="osrs-body relative grid items-center gap-6 p-8 sm:grid-cols-[1fr_auto] sm:p-10">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-semibold text-[var(--color-text)] tracking-normal leading-tight">
                Help keep Scapestack running
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                Free, no ads, no account. Coffee keeps the tools online.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <BuyMeCoffee />
              <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                One-time · from €1 · takes 20 seconds
              </span>
            </div>
          </div>
        </div>
        {/* Bottom tagline removed — the global Scapestack footer in
            app/layout.tsx sits below the BMC block and provides the page's
            final outro. Having a second tagline strip here made the global
            footer disappear from sight. */}
      </footer>
    </main>
  );
}

function SessionSignal({
  icon,
  label,
  value,
  tone
}: {
  icon: number;
  label: string;
  value: string;
  tone: "ready" | "prep";
}) {
  return (
    <div className="scapestack-route-row min-h-[92px] p-3">
      <div className="flex items-start gap-2.5">
        <ItemSprite id={icon} alt="" size={28} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold leading-snug text-[var(--color-text)]">{label}</span>
            <span className="scapestack-status-badge" data-tone={tone}>{tone === "ready" ? "Ready" : "Prep"}</span>
          </div>
          <p className="mt-1 text-[11.5px] font-semibold leading-snug text-[var(--color-text-muted)]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function RoutePreview({
  icon,
  title,
  detail,
  status
}: {
  icon: number;
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45">
        <ItemSprite id={icon} alt="" size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold leading-snug text-[var(--color-text)]">{title}</span>
          <span className="scapestack-status-badge" data-tone="prep">{status}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] font-semibold leading-snug text-[var(--color-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}
