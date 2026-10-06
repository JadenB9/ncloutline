import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { generateRoomCode } from "@/lib/room-code";
import { hashToken } from "@/lib/auth/argon";
import { getAdminSupabase } from "@/lib/supabase/server";
import { signSession, JWT_COOKIE, JWT_COOKIE_OPTIONS } from "@/lib/auth/jwt";
import { NCL_CATEGORIES } from "@/lib/constants";
import { colorForFingerprint, newFingerprint } from "@/lib/utils";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { csrfOk } from "@/lib/auth/csrf";
import { backendAsleep, dbUnreachable } from "@/lib/api/guard";

export const runtime = "nodejs";

const Body = z.object({
  display_name: z.string().min(1).max(32),
  token: z.string().min(1).max(128).nullable().optional(),
});

export async function POST(req: Request) {
  if (!csrfOk(req)) return NextResponse.json({ error: "bad csrf" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { display_name } = parsed.data;
  const token = parsed.data.token || null;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: "create", ip, max: 10, windowSeconds: 3600 });
  if (rl.down) return backendAsleep();
  if (!rl.ok) {
    return NextResponse.json({ error: "too many room creations, try again later" }, { status: 429 });
  }

  const supabase = getAdminSupabase();
  const fingerprint = newFingerprint();
  const color = colorForFingerprint(fingerprint);

  // try a few times in case of code collision (very rare with 32^6 = ~1B codes)
  let roomCode = "";
  let roomId = "";
  const tokenHash = token ? await hashToken(token) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const { data, error, status } = await supabase
      .from("rooms")
      .insert({
        room_code: candidate,
        token_hash: tokenHash,
        creator_fingerprint: fingerprint,
      })
      .select("id, room_code")
      .single();
    if (error) {
      if (dbUnreachable({ status })) return backendAsleep();
      if (attempt === 4) {
        console.error("room_create_failed", error);
        return NextResponse.json({ error: "could not create room" }, { status: 500 });
      }
      continue;
    }
    roomCode = data.room_code;
    roomId = data.id;
    break;
  }

  // seed the hardcoded section set for the room
  const sectionRows = NCL_CATEGORIES.map((c, i) => ({
    room_id: roomId,
    name: c.name,
    category_key: c.key,
    is_custom: false,
    order_index: i,
  }));
  const { error: sectionErr } = await supabase.from("sections").insert(sectionRows);
  if (sectionErr) {
    console.error("seed_sections_failed", sectionErr);
  }

  // register the creator as a room member
  const { error: memberErr } = await supabase.from("room_members").insert({
    room_id: roomId,
    user_fingerprint: fingerprint,
    display_name,
    color,
  });
  if (memberErr) {
    console.error("member_insert_failed", memberErr);
  }

  // activity entry so the right sidebar has something from the start
  await supabase.from("activity_events").insert({
    room_id: roomId,
    actor_fingerprint: fingerprint,
    actor_display_name: display_name,
    actor_color: color,
    verb: "created_room",
  });

  const jwt = await signSession({
    room_id: roomId,
    room_code: roomCode,
    fingerprint,
    display_name,
    color,
  });

  cookies().set({ name: JWT_COOKIE, value: jwt, ...JWT_COOKIE_OPTIONS });

  return NextResponse.json({ room_code: roomCode });
}
