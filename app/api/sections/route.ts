import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CreateSectionBody = z.object({
  name: z.string().min(1).max(60),
});

// list sections for the current room
export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, category_key, is_custom, order_index")
    .eq("room_id", auth.session.room_id)
    .order("order_index", { ascending: true });

  if (error) return bad("fetch failed", 500);
  return NextResponse.json({ sections: data ?? [] });
}

// create a custom section. hardcoded NCL categories are seeded at room creation.
export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = CreateSectionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const { data: last } = await supabase
    .from("sections")
    .select("order_index")
    .eq("room_id", auth.session.room_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("sections")
    .insert({
      room_id: auth.session.room_id,
      name: parsed.data.name.trim(),
      is_custom: true,
      order_index: (last?.order_index ?? -1) + 1,
    })
    .select()
    .single();
  if (error) return bad("insert failed", 500);

  await supabase.from("activity_events").insert({
    room_id: auth.session.room_id,
    actor_fingerprint: auth.session.fingerprint,
    actor_display_name: auth.session.display_name,
    actor_color: auth.session.color,
    verb: "added_section",
    target_id: data.id,
    payload: { name: data.name },
  });

  return NextResponse.json({ section: data });
}
