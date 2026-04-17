import { CreateRoomCard } from "@/components/landing/CreateRoomCard";
import { JoinRoomCard } from "@/components/landing/JoinRoomCard";
import { NCL_CATEGORIES } from "@/lib/constants";

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center gap-6 bg-bg-deep/80">
        <div className="font-mono text-sm text-accent-cyan flex items-center gap-3">
          <span className="text-text-dim">$</span>
          <span>ncl-arena</span>
          <span className="text-text-dim animate-blink">█</span>
        </div>
        <span className="text-[11px] font-mono text-text-dim hidden sm:inline">
          // collaborative team workspace for practicing National Cyber League challenges
        </span>
      </header>

      <section className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-5xl">
          <div className="mb-8 font-mono text-xs text-text-secondary">
            <p className="text-accent-cyan">[ telemetry ]</p>
            <p>
              {NCL_CATEGORIES.length} categories · 3 difficulty tiers · real-time collab · team confidence voting
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <CreateRoomCard />
            <JoinRoomCard />
          </div>

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-5 gap-2">
            {NCL_CATEGORIES.map((c) => (
              <div
                key={c.key}
                className="panel px-2 py-1.5 text-[11px] font-mono text-text-secondary"
                title={c.blurb}
              >
                <span className="text-accent-cyan">:</span> {c.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-3 font-mono text-[11px] text-text-dim flex items-center justify-between">
        <span>rooms expire with inactivity · no accounts · jwt 24h</span>
        <span>j4den.com / NCLtest</span>
      </footer>
    </main>
  );
}
