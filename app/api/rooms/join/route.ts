import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isValidRoomCode } from "@/lib/room-code";
import { verifyToken } from "@/lib/auth/argon";
import { getAdminSupabase } from "@/lib/supabase/server";
import { signSession, JWT_COOKIE, JWT_COOKIE_OPTIONS } from "@/lib/auth/jwt";
import { colorForFingerprint, newFingerprint } from "@/lib/utils";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { csrfOk } from "@/lib/auth/csrf";

export const runtime = "nodejs";

const Body = z.object({
  room_code: z.string().min(6).max(6),
  display_name: z.string().min(1).max(32),
  token: z.string().min(1).max(128).nullable().optional(),
});

const GENERIC_FAIL = "Invalid room code or token";

export async function POST(req: Request) {
  if (!csrfOk(req)) return NextResponse.json({ error: "bad csrf" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidRoomCode(parsed.data.room_code)) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 400 });
  }
  const { room_code, display_name } = parsed.data;
  const token = parsed.data.token || null;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: "join", ip, max: 5, windowSeconds: 60 });
  if (!rl.ok) {
    return NextResponse.json({ error: "too many attempts, slow down" }, { status: 429 });
  }

  const supabase = getAdminSupabase();
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, room_code, token_hash")
    .eq("room_code", room_code)
    .maybeSingle();

  if (error || !room) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
  }

  // token check — constant-ish time via argon2.verify
  if (room.token_hash) {
    if (!token) return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
    const ok = await verifyToken(room.token_hash, token);
    if (!ok) return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
  }

  // cap rooms at 7 members. yjs awareness and realtime presence both get
  // chatty past ~8 clients and the layout is sized for up to 7 cursor colors.
  const { count: memberCount } = await supabase
    .from("room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((memberCount ?? 0) >= 7) {
    return NextResponse.json({ error: "Room is full (7 max)" }, { status: 409 });
  }

  const fingerprint = newFingerprint();
  const color = colorForFingerprint(fingerprint);

  const { error: insertErr } = await supabase.from("room_members").insert({
    room_id: room.id,
    user_fingerprint: fingerprint,
    display_name,
    color,
  });
  if (insertErr) {
    console.error("member_insert_failed", insertErr);
    return NextResponse.json({ error: "could not join" }, { status: 500 });
  }

  await supabase.from("activity_events").insert({
    room_id: room.id,
    actor_fingerprint: fingerprint,
    actor_display_name: display_name,
    actor_color: color,
    verb: "joined_room",
  });

  const jwt = await signSession({
    room_id: room.id,
    room_code: room.room_code,
    fingerprint,
    display_name,
    color,
  });

  cookies().set({ name: JWT_COOKIE, value: jwt, ...JWT_COOKIE_OPTIONS });

  return NextResponse.json({ ok: true });
}
