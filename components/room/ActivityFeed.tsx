"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { relTime } from "@/lib/utils";
import { apiPath } from "@/lib/api-path";

type Event = {
  id: string;
  actor_fingerprint: string | null;
  actor_display_name: string | null;
  actor_color: string | null;
  verb: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const VERB_LABEL: Record<string, string> = {
  joined_room: "joined",
  created_room: "created room",
  added_section: "added section",
  removed_section: "removed section",
  added_question: "added question",
  removed_question: "removed question",
  updated_question: "updated question",
  solved_question: "solved a question",
  locked_answer: "locked team answer",
};

export function ActivityFeed({ roomId }: { roomId: string }) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      const res = await fetch(apiPath("/api/activity"));
      if (!res.ok) return;
      const data = (await res.json()) as { events: Event[] };
      if (!stopped) setEvents(data.events);
    }
    load();

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`room:${roomId}:activity`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setEvents((prev) => [payload.new as Event, ...prev].slice(0, 60));
        }
      )
      .subscribe();

    return () => {
      stopped = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <div className="p-3">
      <div className="text-[10px] uppercase tracking-wider font-mono text-text-dim mb-2">
        activity
      </div>
      <ul className="space-y-1.5">
        {events.length === 0 && (
          <li className="text-[11px] text-text-dim font-mono">waiting for events…</li>
        )}
        {events.map((e) => {
          const verb = VERB_LABEL[e.verb] ?? e.verb;
          const payloadText = formatPayload(e.verb, e.payload);
          return (
            <li key={e.id} className="flex items-start gap-2 text-[11px] font-mono text-text-secondary animate-slide-in">
              <span
                className="status-dot mt-1.5 flex-none"
                style={{ background: e.actor_color ?? "#5A6679" }}
              />
              <div className="flex-1 min-w-0">
                <div>
                  <span style={{ color: e.actor_color ?? undefined }}>
                    {e.actor_display_name ?? "system"}
                  </span>{" "}
                  <span className="text-text-primary">{verb}</span>
                  {payloadText && <span className="text-text-dim"> — {payloadText}</span>}
                </div>
                <div className="text-text-dim text-[10px]">{relTime(e.created_at)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatPayload(verb: string, payload: Record<string, unknown> | null) {
  if (!payload) return "";
  if (verb === "added_question" || verb === "removed_question") {
    const section = payload.section as string | undefined;
    const difficulty = payload.difficulty as string | undefined;
    return [section, difficulty].filter(Boolean).join(" / ");
  }
  if (verb === "locked_answer" && typeof payload.value === "string") {
    const v = payload.value as string;
    return v.length > 24 ? v.slice(0, 24) + "…" : v;
  }
  if (typeof payload.name === "string") return payload.name;
  return "";
}
