import { NextResponse } from "next/server";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// delete a custom section. hardcoded NCL categories can be emptied but not deleted.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const supabase = getAdminSupabase();
  const { data: section } = await supabase
    .from("sections")
    .select("id, is_custom, room_id, name")
    .eq("id", params.id)
    .maybeSingle();

  if (!section || section.room_id !== auth.session.room_id) return bad("not found", 404);
  if (!section.is_custom) return bad("cannot delete built-in category", 409);

  const { error } = await supabase.from("sections").delete().eq("id", params.id);
  if (error) return bad("delete failed", 500);

  await supabase.from("activity_events").insert({
    room_id: auth.session.room_id,
    actor_fingerprint: auth.session.fingerprint,
    actor_display_name: auth.session.display_name,
    actor_color: auth.session.color,
    verb: "removed_section",
    payload: { name: section.name },
  });

  return NextResponse.json({ ok: true });
}
