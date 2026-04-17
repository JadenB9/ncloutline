"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { relTime } from "@/lib/utils";
import type { Me } from "@/components/room/RoomShell";

type Member = {
  user_fingerprint: string;
  display_name: string;
  color: string;
  last_section_id: string | null;
  last_seen_at: string | null;
};

export function PresenceList({ roomId, me }: { roomId: string; me: Me }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      const res = await fetch("/api/presence");
      if (!res.ok) return;
      const data = (await res.json()) as { members: Member[] };
      if (!stopped) setMembers(data.members);
    }
    load();
    const id = setInterval(load, 10_000);

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`room:${roomId}:members`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => { load(); }
      )
      .subscribe();

    return () => {
      stopped = true;
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <div className="py-2">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-mono text-text-dim">
        presence ({members.length})
      </div>
      <ul className="px-2 pb-2 space-y-0.5">
        {members.map((m) => {
          const isMe = m.user_fingerprint === me.fingerprint;
          const seen = m.last_seen_at ? new Date(m.last_seen_at) : null;
          const online = seen ? Date.now() - seen.getTime() < 30_000 : false;
          return (
            <li
              key={m.user_fingerprint}
              className="px-1.5 py-1 flex items-center gap-2 font-mono text-xs"
              title={seen ? relTime(seen) : undefined}
            >
              <span
                className="status-dot"
                style={{ background: online ? m.color : "#3a4258" }}
                aria-label={online ? "online" : "idle"}
              />
              <span className={isMe ? "text-accent-cyan" : "text-text-primary"}>
                {m.display_name}
              </span>
              {isMe && <span className="text-text-dim">(you)</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
