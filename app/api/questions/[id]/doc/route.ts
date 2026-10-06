import { NextResponse } from "next/server";
import { z } from "zod";
import * as Y from "yjs";
import { requireSession, bad } from "@/lib/api/guard";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// the prompt + notes editors for a question share one Y.Doc, stored in
// questions.ydoc_state. y-supabase would read/write that column straight from
// the browser over postgrest, but the browser has no room-scoped auth there
// (and shouldn't be able to write questions directly), so the editors save
// through this route instead.

const MAX_DOC_BYTES = 512 * 1024;

const Body = z.object({
  // base64 of Y.encodeStateAsUpdate(doc)
  state: z.string().min(1).max(Math.ceil((MAX_DOC_BYTES * 4) / 3) + 4),
});

// postgrest hands bytea back as a "\x..." hex string and accepts the same
function fromBytea(v: unknown): Uint8Array | null {
  if (typeof v !== "string" || !v.startsWith("\\x") || v.length <= 2) return null;
  return new Uint8Array(Buffer.from(v.slice(2), "hex"));
}

function toBytea(u: Uint8Array) {
  return "\\x" + Buffer.from(u).toString("hex");
}

// throws if the bytes aren't a yjs update
function checkUpdate(u: Uint8Array) {
  Y.applyUpdate(new Y.Doc(), u);
  return u;
}

async function loadDoc(id: string, roomId: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from("questions")
    .select("id, ydoc_state, sections!inner(room_id)")
    .eq("id", id)
    .maybeSingle();
  const q = data as unknown as { id: string; ydoc_state: unknown; sections: { room_id: string } } | null;
  if (!q || q.sections.room_id !== roomId) return null;
  return q;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  const q = await loadDoc(params.id, auth.session.room_id);
  if (!q) return bad("not found", 404);

  const state = fromBytea(q.ydoc_state);
  return NextResponse.json({ state: state ? Buffer.from(state).toString("base64") : null });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid body");

  const q = await loadDoc(params.id, auth.session.room_id);
  if (!q) return bad("not found", 404);

  const incoming = new Uint8Array(Buffer.from(parsed.data.state, "base64"));
  if (incoming.length > MAX_DOC_BYTES) return bad("document too large", 413);

  // merge into what's stored rather than overwrite, so two people saving at
  // the same moment can't wipe out each other's edits. if the stored bytes
  // aren't a valid update (old y-supabase writes were), start over from ours.
  let merged: Uint8Array;
  try {
    checkUpdate(incoming);
  } catch {
    return bad("invalid document");
  }
  try {
    const existing = fromBytea(q.ydoc_state);
    merged = existing ? checkUpdate(Y.mergeUpdates([existing, incoming])) : incoming;
  } catch {
    merged = incoming;
  }
  if (merged.length > MAX_DOC_BYTES) return bad("document too large", 413);

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("questions")
    .update({ ydoc_state: toBytea(merged) })
    .eq("id", params.id);
  if (error) return bad("save failed", 500);

  return NextResponse.json({ ok: true });
}
