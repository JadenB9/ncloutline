import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  question_id: z.string().uuid(),
  value: z.string().min(1).max(2000),
});

// "Lock as final" — writes the team-agreed answer to questions.flag,
// marks the question solved, and accepts all matching submissions.
export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const { data: q } = await supabase
    .from("questions")
    .select("id, sections!inner(room_id)")
    .eq("id", parsed.data.question_id)
    .maybeSingle();
  const qScoped = q as unknown as { id: string; sections: { room_id: string } } | null;
  if (!qScoped || qScoped.sections.room_id !== auth.session.room_id) return bad("not found", 404);

  await supabase
    .from("questions")
    .update({ flag: parsed.data.value, status: "solved", solved_at: new Date().toISOString() })
    .eq("id", parsed.data.question_id);

  // flag any matching submissions as accepted (case-insensitive match)
  await supabase
    .from("answer_submissions")
    .update({ status: "accepted" })
    .eq("question_id", parsed.data.question_id)
    .filter("value_normalized", "eq", parsed.data.value.trim().toLowerCase());

  await supabase.from("activity_events").insert({
    room_id: auth.session.room_id,
    actor_fingerprint: auth.session.fingerprint,
    actor_display_name: auth.session.display_name,
    actor_color: auth.session.color,
    verb: "locked_answer",
    target_type: "question",
    target_id: parsed.data.question_id,
    payload: { value: parsed.data.value },
  });

  return NextResponse.json({ ok: true });
}
