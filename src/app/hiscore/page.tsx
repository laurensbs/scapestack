import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Search, Shield, Sparkles, Trophy } from "lucide-react";
import { ToolHeader } from "@/components/tool-header";
import { cn } from "@/lib/utils";

async function lookupAction(formData: FormData) {
  "use server";
  const rsn = String(formData.get("rsn") || "").trim().slice(0, 12);
  if (!rsn) return;
  redirect(`/u/${encodeURIComponent(rsn)}`);
}

export default function HiscorePage() {
  return (
    <main className="relative z-10 mx-auto max-w-4xl px-5 py-10 pb-24">
      <ToolHeader slug="hiscore" />

      <section className="animate-[slide-up_0.35s_ease-out]">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
            Look up any OSRS player.
          </h2>
          <p className="mt-3 text-[14px] sm:text-[15px] text-[var(--color-text-dim)] leading-relaxed">
            Live data from the official Hiscores. All 24 skills, combat level, XP,
            and rank — plus their uploaded bank if there is one.
          </p>
        </div>

        {/* Hero search */}
        <form
          action={lookupAction}
          className={cn(
            "flex items-stretch gap-2 max-w-xl mx-auto rounded-2xl p-2",
            "bg-[var(--color-panel)] border border-[var(--color-border)]",
            "focus-within:border-[var(--color-accent)]/50",
            "focus-within:shadow-[0_0_0_3px_rgba(15, 118, 110,0.10)]",
            "transition-all"
          )}
        >
          <div className="relative flex-1">
            <label htmlFor="hiscore-rsn-input" className="sr-only">
              OSRS name for Hiscore lookup
            </label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
            <input
              id="hiscore-rsn-input"
              type="text"
              name="rsn"
              placeholder="Enter a username, e.g. Lynx Titan"
              required
              maxLength={12}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-describedby="hiscore-rsn-help"
              className={cn(
                "w-full pl-11 pr-3 py-3.5 rounded-xl text-[15px] sm:text-[16px]",
                "bg-transparent border-0",
                "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none"
              )}
            />
          </div>
          <button
            type="submit"
            aria-label="Look up OSRS player Hiscores"
            className={cn(
              "flex items-center gap-1.5 px-5 py-3 rounded-xl text-[14px] font-semibold",
              "bg-[var(--color-accent)] text-white",
              "hover:brightness-110 transition-all"
            )}
          >
            Look up
            <ArrowRight className="size-4" />
          </button>
        </form>
        <p
          id="hiscore-rsn-help"
          className="mx-auto mt-2 max-w-xl text-center text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
        >
          Uses the official OSRS Hiscores. Player names are capped at 12 characters; add bank or RuneLite sync later for sharper planning.
        </p>

        {/* Try-these suggestions as featured chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11.5px] text-[var(--color-text-muted)] mr-1">
            Try:
          </span>
          {[
            { name: "Lynx Titan", note: "max XP" },
            { name: "Zezima", note: "OG hero" },
            { name: "Settled", note: "ironman pioneer" },
            { name: "B0aty", note: "" }
          ].map((p) => (
            <Link
              key={p.name}
              href={`/u/${encodeURIComponent(p.name)}`}
              className={cn(
                "group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px]",
                "bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-text-dim)]",
                "hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 transition-colors"
              )}
            >
              {p.name}
              {p.note && <span className="text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-muted)]">· {p.note}</span>}
            </Link>
          ))}
        </div>

        {/* What you'll see */}
        <div className="mt-14 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          <Feature icon={Shield} title="Combat & total" body="Combat level + total level + XP, derived from raw skills." />
          <Feature icon={Trophy} title="Top skills" body="Top 3 highlighted, full skill grid with ranks." />
          <Feature icon={Sparkles} title="Plus your bank" body="If you uploaded one before, your top items show up too." />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="surface p-4">
      <Icon className="size-4 text-[var(--color-accent)] mb-2" />
      <div className="text-[13px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <p className="text-[12px] text-[var(--color-text-dim)] leading-relaxed">{body}</p>
    </div>
  );
}
