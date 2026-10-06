import { RoomEntry } from "@/components/landing/RoomEntry";
import { NCL_CATEGORIES } from "@/lib/constants";

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/60">
        <span className="font-display text-[15px] font-semibold tracking-tight text-text-primary">
          NCL Arena
        </span>
        <span className="hidden sm:inline text-[13px] text-text-dim">
          National Cyber League practice
        </span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="text-center max-w-xl animate-rise-in">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
            Practice NCL as a team
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            Shared notes, answer voting, and live presence for up to seven
            teammates. No accounts — create a room and share the code.
          </p>
        </div>

        <div
          className="w-full max-w-[26rem] mt-8 animate-rise-in"
          style={{ animationDelay: "90ms" }}
        >
          <RoomEntry />
        </div>

        <p
          className="mt-8 max-w-lg text-center text-[13px] leading-relaxed text-text-dim animate-rise-in"
          style={{ animationDelay: "180ms" }}
        >
          Covers all ten NCL categories —{" "}
          {NCL_CATEGORIES.map((c) => c.name).join(", ")}.
        </p>
      </section>

      <footer className="px-6 py-4 border-t border-border/60 flex items-center justify-between text-[12px] text-text-dim">
        <span>Only people with the room code can get in</span>
        <a href="https://j4den.com" className="hover:text-text-secondary">
          j4den.com
        </a>
      </footer>
    </main>
  );
}
