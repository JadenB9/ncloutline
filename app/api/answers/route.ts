import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const QuestionId = z.string().uuid();

const UpsertBody = z.object({
  question_id: z.string().uuid(),
  value: z.string().trim().min(1).max(2000),
  confidence: z.number().int().min(0).max(100),
});

// get all submissions + the aggregated team confidence groups for a question
export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const questionId = url.searchParams.get("question_id");
  if (!QuestionId.safeParse(questionId).success) return bad("question_id required");

  const supabase = getAdminSupabase();
  // scope check: does this question belong to our room?
  const { data: q } = await supabase
    .from("questions")
    .select("id, sections!inner(room_id)")
    .eq("id", questionId)
    .maybeSingle();
  const qScoped = q as unknown as { id: string; sections: { room_id: string } } | null;
  if (!qScoped || qScoped.sections.room_id !== auth.session.room_id) return bad("not found", 404);

  const [subs, groups] = await Promise.all([
    supabase
      .from("answer_submissions")
      .select("id, user_fingerprint, display_name, color, value, confidence, status, updated_at")
      .eq("question_id", questionId),
    supabase
      .from("question_answer_groups")
      .select("value_normalized, display_value, agreer_count, avg_confidence, team_confidence, submissions")
      .eq("question_id", questionId),
  ]);
  if (subs.error || groups.error) return bad("fetch failed", 500);

  // only this question's strikes -- this used to pull every strike in the
  // whole database and filter it here
  const submissionIds = (subs.data ?? []).map((s) => s.id);
  let strikes: Array<{ id: string; submission_id: string; user_fingerprint: string }> = [];
  if (submissionIds.length > 0) {
    const res = await supabase
      .from("answer_strikes")
      .select("id, submission_id, user_fingerprint")
      .in("submission_id", submissionIds);
    if (res.error) return bad("fetch failed", 500);
    strikes = res.data ?? [];
  }

  return NextResponse.json({
    submissions: subs.data ?? [],
    groups: groups.data ?? [],
    strikes,
  });
}

// insert or update our own submission for a question (one row per user per question)
export async function PUT(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = UpsertBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const { data: q } = await supabase
    .from("questions")
    .select("id, sections!inner(room_id)")
    .eq("id", parsed.data.question_id)
    .maybeSingle();
  const qScoped = q as unknown as { id: string; sections: { room_id: string } } | null;
  if (!qScoped || qScoped.sections.room_id !== auth.session.room_id) return bad("not found", 404);

  const { data, error } = await supabase
    .from("answer_submissions")
    .upsert(
      {
        question_id: parsed.data.question_id,
        room_id: auth.session.room_id,
        user_fingerprint: auth.session.fingerprint,
        display_name: auth.session.display_name,
        color: auth.session.color,
        value: parsed.data.value,
        confidence: parsed.data.confidence,
        status: "proposed",
      },
      { onConflict: "question_id,user_fingerprint" }
    )
    .select()
    .single();
  if (error) return bad("upsert failed", 500);

  return NextResponse.json({ submission: data });
}

export async function DELETE(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const questionId = url.searchParams.get("question_id");
  if (!QuestionId.safeParse(questionId).success) return bad("question_id required");

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("answer_submissions")
    .delete()
    .eq("question_id", questionId!)
    .eq("room_id", auth.session.room_id)
    .eq("user_fingerprint", auth.session.fingerprint);
  if (error) return bad("delete failed", 500);
  return NextResponse.json({ ok: true });
}
