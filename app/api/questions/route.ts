import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { DIFFICULTIES } from "@/lib/constants";

export const runtime = "nodejs";

const CreateBody = z.object({
  section_id: z.string().uuid(),
  difficulty: z.enum(DIFFICULTIES as unknown as [string, ...string[]]),
  points: z.number().int().min(0).max(10000).optional(),
});

export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const sectionId = url.searchParams.get("section_id");
  if (!z.string().uuid().safeParse(sectionId).success) return bad("section_id required");

  const supabase = getAdminSupabase();
  // make sure the section belongs to the session's room
  const { data: section } = await supabase
    .from("sections")
    .select("room_id")
    .eq("id", sectionId!)
    .maybeSingle();
  if (!section || section.room_id !== auth.session.room_id) return bad("not found", 404);

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, section_id, difficulty, prompt, notes, flag, points, status, order_index, updated_at, claimed_by, solved_at")
    .eq("section_id", sectionId!)
    .order("difficulty", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) return bad("fetch failed", 500);

  return NextResponse.json({ questions: questions ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const { data: section } = await supabase
    .from("sections")
    .select("room_id, name")
    .eq("id", parsed.data.section_id)
    .maybeSingle();
  if (!section || section.room_id !== auth.session.room_id) return bad("not found", 404);

  const { data: last } = await supabase
    .from("questions")
    .select("order_index")
    .eq("section_id", parsed.data.section_id)
    .eq("difficulty", parsed.data.difficulty)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("questions")
    .insert({
      section_id: parsed.data.section_id,
      difficulty: parsed.data.difficulty,
      points: parsed.data.points ?? 0,
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
    verb: "added_question",
    target_type: "question",
    target_id: data.id,
    payload: { section: section.name, difficulty: parsed.data.difficulty },
  });

  return NextResponse.json({ question: data });
}
