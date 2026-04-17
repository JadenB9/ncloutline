"use client";

import { useEffect, useState, useCallback } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DIFFICULTIES, DIFFICULTY_LABEL, type DifficultyTier, CATEGORY_BY_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/room/QuestionCard";
import { Plus } from "lucide-react";
import type { Section, Me } from "@/components/room/RoomShell";

export type Question = {
  id: string;
  section_id: string;
  difficulty: DifficultyTier;
  prompt: string;
  notes: string;
  flag: string;
  points: number;
  status: "not_started" | "in_progress" | "solved";
  order_index: number;
  updated_at: string;
  claimed_by: string | null;
  solved_at: string | null;
};

export function QuestionColumn({
  section,
  me,
  csrfFetch,
}: {
  section: Section;
  me: Me;
  csrfFetch: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/questions?section_id=${section.id}`);
    if (res.ok) {
      const data = (await res.json()) as { questions: Question[] };
      setQuestions(data.questions);
    }
    setLoading(false);
  }, [section.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`section:${section.id}:questions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `section_id=eq.${section.id}`,
        },
        (payload) => {
          setQuestions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Question;
              if (prev.some((q) => q.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id: string };
              return prev.filter((q) => q.id !== oldRow.id);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Question;
              return prev.map((q) => (q.id === row.id ? { ...q, ...row } : q));
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [section.id]);

  async function addQuestion(difficulty: DifficultyTier) {
    const res = await csrfFetch("/api/questions", {
      method: "POST",
      body: JSON.stringify({ section_id: section.id, difficulty, points: 0 }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { question: Question };
    setQuestions((prev) => [...prev, data.question]);
  }

  const blurb = section.category_key ? CATEGORY_BY_KEY[section.category_key]?.blurb : null;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 pb-3 border-b border-border">
        <h1 className="font-mono text-lg text-accent-cyan uppercase tracking-wide">
          {section.name}
        </h1>
        {blurb && (
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">{blurb}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-bg-elevated border border-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {DIFFICULTIES.map((d) => {
            const rows = questions.filter((q) => q.difficulty === d);
            return (
              <DifficultyGroup
                key={d}
                difficulty={d}
                questions={rows}
                onAdd={() => addQuestion(d)}
                me={me}
                csrfFetch={csrfFetch}
                onRemoved={(id) => setQuestions((prev) => prev.filter((q) => q.id !== id))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DifficultyGroup({
  difficulty,
  questions,
  onAdd,
  me,
  csrfFetch,
  onRemoved,
}: {
  difficulty: DifficultyTier;
  questions: Question[];
  onAdd: () => void;
  me: Me;
  csrfFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRemoved: (id: string) => void;
}) {
  const color = difficulty === "easy" ? "#00FF88" : difficulty === "medium" ? "#FFB800" : "#FF3355";
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="status-dot" style={{ background: color }} />
        <h2 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
          {DIFFICULTY_LABEL[difficulty]}
        </h2>
        <span className="text-[11px] font-mono text-text-dim">
          ({questions.length})
        </span>
        <Button size="sm" variant="ghost" onClick={onAdd} className="ml-auto">
          <Plus size={12} /> add
        </Button>
      </div>
      {questions.length === 0 ? (
        <div className="text-[11px] text-text-dim font-mono py-2 px-3 border border-dashed border-border">
          no {DIFFICULTY_LABEL[difficulty].toLowerCase()} questions yet
        </div>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id}>
              <QuestionCard
                question={q}
                me={me}
                csrfFetch={csrfFetch}
                onRemoved={() => onRemoved(q.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
