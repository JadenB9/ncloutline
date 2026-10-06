import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  prompt: z.string().max(20000).optional(),
  notes: z.string().max(20000).optional(),
  flag: z.string().max(2000).optional(),
  points: z.number().int().min(0).max(10000).optional(),
  status: z.enum(["not_started", "in_progress", "solved"]).optional(),
  claim: z.boolean().optional(),
});

async function assertSameRoom(supabase: ReturnType<typeof getAdminSupabase>, questionId: string, roomId: string) {
  const { data } = await supabase
    .from("questions")
    .select("id, section_id, sections!inner(room_id)")
    .eq("id", questionId)
    .maybeSingle();
  if (!data) return null;
  const q = data as unknown as { id: string; sections: { room_id: string } };
  if (q.sections.room_id !== roomId) return null;
  return q;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const supabase = getAdminSupabase();
  const q = await assertSameRoom(supabase, id, auth.session.room_id);
  if (!q) return bad("not found", 404);

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.claim;

  if (parsed.data.claim !== undefined) {
    // look up our member row so we can store a proper uuid on claimed_by
    const { data: member } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", auth.session.room_id)
      .eq("user_fingerprint", auth.session.fingerprint)
      .maybeSingle();
    patch.claimed_by = parsed.data.claim ? member?.id ?? null : null;
    patch.claimed_at = parsed.data.claim ? new Date().toISOString() : null;
  }

  if (parsed.data.status === "solved") {
    patch.solved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("questions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return bad("update failed", 500);

  await supabase.from("activity_events").insert({
    room_id: auth.session.room_id,
    actor_fingerprint: auth.session.fingerprint,
    actor_display_name: auth.session.display_name,
    actor_color: auth.session.color,
    verb: parsed.data.status === "solved" ? "solved_question" : "updated_question",
    target_type: "question",
    target_id: id,
    payload: parsed.data.status ? { status: parsed.data.status } : null,
  });

  return NextResponse.json({ question: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const supabase = getAdminSupabase();
  const q = await assertSameRoom(supabase, id, auth.session.room_id);
  if (!q) return bad("not found", 404);

  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return bad("delete failed", 500);

  await supabase.from("activity_events").insert({
    room_id: auth.session.room_id,
    actor_fingerprint: auth.session.fingerprint,
    actor_display_name: auth.session.display_name,
    actor_color: auth.session.color,
    verb: "removed_question",
    target_type: "question",
    target_id: id,
  });

  return NextResponse.json({ ok: true });
}
