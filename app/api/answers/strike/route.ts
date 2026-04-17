import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({ submission_id: z.string().uuid() });

// toggle a strike on another user's submission. one strike per user per submission.
export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  // verify the submission is in our room
  const { data: sub } = await supabase
    .from("answer_submissions")
    .select("id, room_id")
    .eq("id", parsed.data.submission_id)
    .maybeSingle();
  if (!sub || sub.room_id !== auth.session.room_id) return bad("not found", 404);

  const { data: existing } = await supabase
    .from("answer_strikes")
    .select("id")
    .eq("submission_id", parsed.data.submission_id)
    .eq("user_fingerprint", auth.session.fingerprint)
    .maybeSingle();

  if (existing) {
    await supabase.from("answer_strikes").delete().eq("id", existing.id);
    return NextResponse.json({ struck: false });
  } else {
    await supabase.from("answer_strikes").insert({
      submission_id: parsed.data.submission_id,
      user_fingerprint: auth.session.fingerprint,
    });
    return NextResponse.json({ struck: true });
  }
}
