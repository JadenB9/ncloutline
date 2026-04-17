import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  section_id: z.string().uuid().nullable(),
});

// heartbeat + last viewed section. called every ~15s from the room page.
export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("room_members")
    .update({
      last_seen_at: new Date().toISOString(),
      last_section_id: parsed.data.section_id,
    })
    .eq("room_id", auth.session.room_id)
    .eq("user_fingerprint", auth.session.fingerprint);
  if (error) return bad("presence failed", 500);

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("room_members")
    .select("user_fingerprint, display_name, color, last_section_id, last_seen_at")
    .eq("room_id", auth.session.room_id)
    .order("joined_at", { ascending: true });
  if (error) return bad("fetch failed", 500);
  return NextResponse.json({ members: data ?? [] });
}
