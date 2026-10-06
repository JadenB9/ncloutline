import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { JWT_COOKIE, verifySession } from "@/lib/auth/jwt";
import { COOKIE_PATH } from "@/lib/auth/cookies";

export const runtime = "nodejs";

// returns who the client is (name, color, room) and their jwt for realtime auth.
// jwt is httpOnly so the browser normally can't read it — we return it here so
// the supabase realtime client can call setAuth() for RLS-scoped subscriptions.
export async function GET() {
  const token = cookies().get(JWT_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });
  return NextResponse.json({
    room_id: session.room_id,
    room_code: session.room_code,
    fingerprint: session.fingerprint,
    display_name: session.display_name,
    color: session.color,
    token,
  });
}

export async function DELETE() {
  cookies().set({ name: JWT_COOKIE, value: "", path: COOKIE_PATH, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
