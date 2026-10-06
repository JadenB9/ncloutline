"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { SectionList } from "@/components/room/SectionList";
import { QuestionColumn } from "@/components/room/QuestionColumn";
import { ActivityFeed } from "@/components/room/ActivityFeed";
import { PresenceList } from "@/components/room/PresenceList";
import { getBrowserSupabase, setSupabaseAuthToken } from "@/lib/supabase/client";
import { BACKEND_ASLEEP_MSG } from "@/lib/constants";
import { apiPath, inviteLink } from "@/lib/api-path";
import { csrfFetch } from "@/lib/auth/csrf-client";

export type Me = {
  room_id: string;
  room_code: string;
  fingerprint: string;
  display_name: string;
  color: string;
  token: string;
};

export type Section = {
  id: string;
  name: string;
  category_key: string | null;
  is_custom: boolean;
  order_index: number;
};

export type RoomFetch = (url: string, init?: RequestInit) => Promise<Response>;

// turn a failed write into something worth showing the user
async function describeFailure(res: Response) {
  if (res.status === 0) return "Network error. Your last change wasn't saved.";
  if (res.status >= 502 && res.status <= 504) return BACKEND_ASLEEP_MSG;
  if (res.status === 401) return "Your session has expired. Leave and rejoin the room.";
  const data = (await res.clone().json().catch(() => null)) as { error?: string } | null;
  return `Couldn't save that change${data?.error ? ` (${data.error})` : ""}.`;
}

export function RoomShell({ me, initialSections }: { me: Me; initialSections: Section[] }) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    initialSections[0]?.id ?? null
  );
  const presenceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  // every write in the room goes through here, so it's the one place that
  // tells the user when something didn't save. a network failure comes back
  // as a status-0 Response so callers only ever have to check res.ok.
  const roomFetch = useCallback<RoomFetch>(async (url, init = {}) => {
    const res = await csrfFetch(url, init).catch(() => Response.error());
    if (!res.ok) setNotice(await describeFailure(res));
    return res;
  }, []);

  // hand our JWT to supabase-js so realtime + postgrest run under RLS
  useEffect(() => {
    setSupabaseAuthToken(me.token);
  }, [me.token]);

  // subscribe to section add/remove for this room
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`room:${me.room_id}:sections`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sections",
          filter: `room_id=eq.${me.room_id}`,
        },
        (payload) => {
          setSections((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Section;
              if (prev.some((s) => s.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.order_index - b.order_index);
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id: string };
              return prev.filter((s) => s.id !== oldRow.id);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Section;
              return prev.map((s) => (s.id === row.id ? row : s));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me.room_id]);

  // presence heartbeat so the PresenceList has accurate last_seen_at
  useEffect(() => {
    const tick = () => {
      csrfFetch("/api/presence", {
        method: "POST",
        body: JSON.stringify({ section_id: activeSectionId }),
      }).catch(() => {});
    };
    tick();
    presenceTimer.current = setInterval(tick, 15000);
    return () => {
      if (presenceTimer.current) clearInterval(presenceTimer.current);
    };
  }, [activeSectionId]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;

  async function addSection() {
    const name = window.prompt("Name for new custom section?");
    if (!name) return;
    const res = await roomFetch("/api/sections", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { section: Section };
    // add it ourselves rather than waiting on the realtime echo
    setSections((prev) => (prev.some((s) => s.id === data.section.id) ? prev : [...prev, data.section]));
    setActiveSectionId(data.section.id);
  }

  async function removeSection(section: Section) {
    if (!section.is_custom) return;
    if (!window.confirm(`Delete "${section.name}"? Questions inside will be removed.`)) return;
    const res = await roomFetch(`/api/sections/${section.id}`, { method: "DELETE" });
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== section.id));
      if (activeSectionId === section.id) {
        setActiveSectionId(sections.find((s) => s.id !== section.id)?.id ?? null);
      }
    }
  }

  async function logout() {
    await csrfFetch("/api/me", { method: "DELETE" }).catch(() => {});
    // a plain "/" would leave the app for the j4den.com home page
    window.location.href = apiPath("/");
  }

  function selectSection(id: string) {
    setActiveSectionId(id);
    setNavOpen(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <RoomHeader roomCode={me.room_code} me={me} onLogout={logout} />

      {notice && (
        <div
          role="alert"
          className="px-4 py-2 flex items-start gap-3 border-b border-accent-red/40 bg-accent-red/10 text-[13px] text-text-primary"
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* below lg the sidebar collapses behind this bar */}
      <button
        type="button"
        onClick={() => setNavOpen((v) => !v)}
        aria-expanded={navOpen}
        aria-controls="room-nav"
        className="lg:hidden px-4 py-2.5 flex items-center gap-2 border-b border-border bg-bg-panel text-left font-mono text-xs text-text-primary"
      >
        <Menu size={14} className="text-text-secondary" />
        <span className="flex-1 truncate">{activeSection?.name ?? "Sections"}</span>
        <ChevronDown size={14} className={navOpen ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[240px_1fr_280px] min-h-0">
        <aside
          id="room-nav"
          className={`${navOpen ? "block" : "hidden"} lg:block border-b lg:border-b-0 lg:border-r border-border panel overflow-y-auto scroll-thin max-h-[70vh] lg:max-h-none`}
        >
          <SectionList
            sections={sections}
            activeId={activeSectionId}
            onSelect={selectSection}
            onAdd={addSection}
            onRemove={removeSection}
          />
          <div className="border-t border-border mt-2">
            <PresenceList roomId={me.room_id} me={me} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto scroll-thin bg-bg-deep/60">
          {activeSection ? (
            <QuestionColumn
              section={activeSection}
              me={me}
              csrfFetch={roomFetch}
            />
          ) : (
            <div className="grid place-items-center h-full text-text-dim font-mono text-xs">
              no section selected
            </div>
          )}
        </main>

        <aside className="border-t lg:border-t-0 lg:border-l border-border panel overflow-y-auto scroll-thin max-h-80 lg:max-h-none">
          <ActivityFeed roomId={me.room_id} />
        </aside>
      </div>
    </div>
  );
}

function RoomHeader({ roomCode, me, onLogout }: { roomCode: string; me: Me; onLogout: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink(roomCode));
      setCopied("Invite link copied");
    } catch {
      setCopied("Copy failed");
    }
    setTimeout(() => setCopied(null), 1500);
  }
  return (
    <header className="border-b border-border px-4 py-2.5 flex items-center gap-3 bg-bg-deep/80 text-sm">
      <span className="font-display font-semibold text-text-primary">NCL Arena</span>
      <span className="text-text-dim">/</span>
      <button
        onClick={copy}
        className="font-mono text-[13px] text-accent-cyan hover:underline decoration-dotted underline-offset-2"
        title="Copy invite link"
        aria-label={`Room ${roomCode}, copy invite link`}
      >
        {roomCode}
      </button>
      {copied && <span role="status" className="text-accent-green text-xs">{copied}</span>}
      <div className="ml-auto flex items-center gap-3">
        <span
          className="status-dot"
          style={{ background: me.color }}
          aria-hidden
        />
        <span className="text-text-primary text-[13px]">{me.display_name}</span>
        <button
          onClick={onLogout}
          className="text-text-secondary hover:text-accent-red text-[13px]"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
