import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { JWT_COOKIE, verifySession } from "@/lib/auth/jwt";
import { COOKIE_PATH } from "@/lib/auth/cookies";
import { csrfOk } from "@/lib/auth/csrf";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// returns who the client is (name, color, room) so the landing page can offer
// to take them back to their room. the jwt itself stays in its httpOnly
// cookie -- the room page hands it to the realtime client server-side.
// not being in a room is the normal case on the landing page, so it's a 200
// with null rather than a 401 that shows up as a console error.
export async function GET() {
  const token = cookies().get(JWT_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json(null);
  return NextResponse.json({
    room_id: session.room_id,
    room_code: session.room_code,
    fingerprint: session.fingerprint,
    display_name: session.display_name,
    color: session.color,
  });
}

// leave the room: drop our member row so the seat frees up, then the cookie
export async function DELETE(req: Request) {
  if (!csrfOk(req)) return NextResponse.json({ error: "bad csrf" }, { status: 403 });

  const token = cookies().get(JWT_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (session) {
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", session.room_id)
      .eq("user_fingerprint", session.fingerprint);
    if (!error) {
      await supabase.from("activity_events").insert({
        room_id: session.room_id,
        actor_fingerprint: session.fingerprint,
        actor_display_name: session.display_name,
        actor_color: session.color,
        verb: "left_room",
      });
    }
  }

  cookies().set({ name: JWT_COOKIE, value: "", path: COOKIE_PATH, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
