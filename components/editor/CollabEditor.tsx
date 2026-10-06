"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
// y-supabase ships files under lib/ but main points to a missing root file
import SupabaseProvider from "y-supabase/lib/y-supabase";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { apiPath } from "@/lib/api-path";
import { csrfFetch } from "@/lib/auth/csrf-client";

export type CollabEditorProps = {
  // one Y.Doc is created per question — named fragments inside it cover
  // prompt / notes / flag so we only need one bytea column on the questions table.
  questionId: string;
  field: "prompt" | "notes" | "flag";
  placeholder?: string;
  user: { name: string; color: string };
  className?: string;
  readOnly?: boolean;
};

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// y-supabase syncs edits between open tabs over a realtime broadcast channel,
// which is the part we want. it also loads/saves the doc straight through
// postgrest, which never worked here: the browser client has no room-scoped
// auth for postgrest, so every save silently matched zero rows and notes were
// lost once everyone left. load/save through our own api route instead.
class ApiBackedProvider extends SupabaseProvider {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  // the original fetches the doc over postgrest here; we load it in
  // getDocBundle, so only keep the "we're online" bookkeeping
  onConnect() {
    this.isOnline(true);
    this.emit("status", [{ status: "connected" }]);
    if (this.awareness.getLocalState() !== null) {
      this.emit("awareness", encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    }
  }

  // runs on every local keystroke -- batch them into one save
  save() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 1500);
  }

  flush(keepalive = false) {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const state = toBase64(Y.encodeStateAsUpdate(this.doc));
    csrfFetch(`/api/questions/${this.config.id}/doc`, {
      method: "PUT",
      body: JSON.stringify({ state }),
      keepalive,
    }).catch(() => {
      // offline or backend asleep. the next edit sends the whole doc again.
    });
  }
}

// cache providers so the ydoc stays alive across card re-mounts
const cache = new Map<string, { doc: Y.Doc; provider: ApiBackedProvider }>();

// don't drop the last second of typing when the tab closes, and drop our
// cursor from everyone else's view
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    cache.forEach(({ doc, provider }) => {
      provider.flush(true);
      removeAwarenessStates(provider.awareness, [doc.clientID], "window unload");
    });
  });
}

function getDocBundle(questionId: string) {
  const hit = cache.get(questionId);
  if (hit) return hit;

  const doc = new Y.Doc();
  const supabase = getBrowserSupabase();
  const provider = new ApiBackedProvider(doc, supabase as never, {
    channel: `q:${questionId}`,
    id: questionId,
    tableName: "questions",
    // the default full-state rebroadcast every 5s per open question burns
    // through the realtime message quota fast with a full team in the room
    resyncInterval: 30000,
  });
  // y-supabase registers its own unload handler unbound, so it throws on
  // every page unload. the pagehide handler above does the same job.
  window.removeEventListener("beforeunload", provider.removeSelfFromAwarenessOnUnload);
  // a realtime channel error is emitted as an "error" event, which throws if
  // nobody is listening. editing still works locally and saves via the api.
  provider.on("error", () => {});

  // applied with the provider as origin so it isn't echoed back as a save
  fetch(apiPath(`/api/questions/${questionId}/doc`))
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { state: string | null } | null) => {
      if (data?.state) Y.applyUpdate(doc, fromBase64(data.state), provider);
    })
    .catch(() => {});

  const bundle = { doc, provider };
  cache.set(questionId, bundle);
  return bundle;
}

export function CollabEditor({
  questionId,
  field,
  placeholder,
  user,
  className,
  readOnly,
}: CollabEditorProps) {
  const providerRef = useRef<{ doc: Y.Doc; provider: ApiBackedProvider } | null>(null);

  const bundle = useMemo(() => {
    providerRef.current = getDocBundle(questionId);
    return providerRef.current;
  }, [questionId]);

  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ history: false }),
        Placeholder.configure({ placeholder: placeholder ?? "" }),
        Collaboration.configure({ document: bundle.doc, field }),
        CollaborationCursor.configure({
          provider: bundle.provider as unknown as never,
          user,
        }),
      ],
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "outline-none",
          "data-placeholder": placeholder ?? "",
        },
      },
    },
    [bundle.doc, field]
  );

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return <EditorContent editor={editor} className={className ?? "tiptap-editor"} />;
}
