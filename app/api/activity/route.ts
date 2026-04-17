import { NextResponse } from "next/server";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, actor_fingerprint, actor_display_name, actor_color, verb, target_type, target_id, payload, created_at")
    .eq("room_id", auth.session.room_id)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return bad("fetch failed", 500);
  return NextResponse.json({ events: data ?? [] });
}
