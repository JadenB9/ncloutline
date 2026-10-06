import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  question_id: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function GET(req: Request) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const questionId = url.searchParams.get("question_id");
  if (!z.string().uuid().safeParse(questionId).success) return bad("question_id required");

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("discussion_messages")
    .select("id, user_fingerprint, display_name, color, body, created_at")
    .eq("question_id", questionId!)
    .eq("room_id", auth.session.room_id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return bad("fetch failed", 500);
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  // scope check
  const { data: q } = await supabase
    .from("questions")
    .select("id, sections!inner(room_id)")
    .eq("id", parsed.data.question_id)
    .maybeSingle();
  const qScoped = q as unknown as { id: string; sections: { room_id: string } } | null;
  if (!qScoped || qScoped.sections.room_id !== auth.session.room_id) return bad("not found", 404);

  const { data, error } = await supabase
    .from("discussion_messages")
    .insert({
      question_id: parsed.data.question_id,
      room_id: auth.session.room_id,
      user_fingerprint: auth.session.fingerprint,
      display_name: auth.session.display_name,
      color: auth.session.color,
      body: parsed.data.body,
    })
    .select()
    .single();
  if (error) return bad("insert failed", 500);
  return NextResponse.json({ message: data });
}
