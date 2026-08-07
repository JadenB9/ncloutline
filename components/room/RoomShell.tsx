"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import * as Icons from "lucide-react";
import { SectionList } from "@/components/room/SectionList";
import { QuestionColumn } from "@/components/room/QuestionColumn";
import { ActivityFeed } from "@/components/room/ActivityFeed";
import { PresenceList } from "@/components/room/PresenceList";
import { getBrowserSupabase, setSupabaseAuthToken } from "@/lib/supabase/client";
import { CATEGORY_BY_KEY } from "@/lib/constants";
import { apiPath } from "@/lib/api-path";
import { ensureCsrf } from "@/lib/auth/csrf-client";

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

export function useCsrfFetch() {
  return useCallback(async (url: string, init: RequestInit = {}) => {
    const csrf = await ensureCsrf();
    const headers = new Headers(init.headers ?? {});
    headers.set("x-csrf-token", csrf);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(apiPath(url), { ...init, headers });
  }, []);
}

export function RoomShell({ me, initialSections }: { me: Me; initialSections: Section[] }) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    initialSections[0]?.id ?? null
  );
  const presenceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const csrfFetch = useCsrfFetch();

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
  }, [activeSectionId, csrfFetch]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;

  async function addSection() {
    const name = window.prompt("Name for new custom section?");
    if (!name) return;
    const res = await csrfFetch("/api/sections", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { section: Section };
    setActiveSectionId(data.section.id);
  }

  async function removeSection(section: Section) {
    if (!section.is_custom) return;
    if (!window.confirm(`Delete "${section.name}"? Questions inside will be removed.`)) return;
    const res = await csrfFetch(`/api/sections/${section.id}`, { method: "DELETE" });
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== section.id));
      if (activeSectionId === section.id) {
        setActiveSectionId(sections.find((s) => s.id !== section.id)?.id ?? null);
      }
    }
  }

  async function logout() {
    await fetch(apiPath("/api/me"), { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <RoomHeader roomCode={me.room_code} me={me} onLogout={logout} />

      <div className="flex-1 grid grid-cols-[240px_1fr_280px] min-h-0">
        <aside className="border-r border-border panel overflow-y-auto scroll-thin">
          <SectionList
            sections={sections}
            activeId={activeSectionId}
            onSelect={setActiveSectionId}
            onAdd={addSection}
            onRemove={removeSection}
          />
          <div className="border-t border-border mt-2">
            <PresenceList roomId={me.room_id} me={me} />
          </div>
        </aside>

        <main className="overflow-y-auto scroll-thin bg-bg-deep/60">
          {activeSection ? (
            <QuestionColumn
              section={activeSection}
              me={me}
              csrfFetch={csrfFetch}
            />
          ) : (
            <div className="grid place-items-center h-full text-text-dim font-mono text-xs">
              no section selected
            </div>
          )}
        </main>

        <aside className="border-l border-border panel overflow-y-auto scroll-thin">
          <ActivityFeed roomId={me.room_id} />
        </aside>
      </div>
    </div>
  );
}

function RoomHeader({ roomCode, me, onLogout }: { roomCode: string; me: Me; onLogout: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <header className="border-b border-border px-4 py-2.5 flex items-center gap-3 bg-bg-deep/80 text-sm">
      <span className="font-display font-semibold text-text-primary">NCL Arena</span>
      <span className="text-text-dim">/</span>
      <button
        onClick={copy}
        className="font-mono text-[13px] text-accent-cyan hover:underline decoration-dotted underline-offset-2"
        title="Copy room code"
      >
        {roomCode}
      </button>
      {copied && <span className="text-accent-green text-xs">Copied</span>}
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

// surface lucide icon lookup to other components
export function IconByName({ name, size = 14 }: { name: string; size?: number }) {
  const key = (CATEGORY_BY_KEY[name]?.icon ?? "Hash") as keyof typeof Icons;
  const Comp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[
    CATEGORY_BY_KEY[name]?.icon ?? "Hash"
  ];
  if (!Comp) return null;
  return <Comp size={size} />;
}
