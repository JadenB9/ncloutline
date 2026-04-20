"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
// y-supabase ships files under lib/ but main points to a missing root file
import SupabaseProvider from "y-supabase/lib/y-supabase";
import { getBrowserSupabase } from "@/lib/supabase/client";

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

// cache providers so the ydoc stays alive across card re-mounts
const cache = new Map<string, { doc: Y.Doc; provider: SupabaseProvider }>();

function getDocBundle(questionId: string) {
  const hit = cache.get(questionId);
  if (hit) return hit;

  const doc = new Y.Doc();
  const supabase = getBrowserSupabase();
  const provider = new SupabaseProvider(doc, supabase as never, {
    channel: `q:${questionId}`,
    id: questionId,
    tableName: "questions",
    columnName: "ydoc_state",
  } as never);
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
  const providerRef = useRef<{ doc: Y.Doc; provider: SupabaseProvider } | null>(null);

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
