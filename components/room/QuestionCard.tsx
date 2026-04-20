"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { STATUS_LABEL, STATUS_COLOR, DIFFICULTY_LABEL, confidenceColor } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ConfidenceBar } from "@/components/room/ConfidenceBar";
import { relTime } from "@/lib/utils";
import { MessageSquare, Lock, Trash2, Hand, X, ChevronDown, ChevronRight, Send, ShieldX } from "lucide-react";
import type { Question } from "@/components/room/QuestionColumn";
import type { Me } from "@/components/room/RoomShell";
import { apiPath } from "@/lib/api-path";

// tiptap + yjs only work client-side; dynamic import avoids SSR attempting to initialize
const CollabEditor = dynamic(
  () => import("@/components/editor/CollabEditor").then((m) => m.CollabEditor),
  { ssr: false, loading: () => <div className="h-6 bg-bg-deep border border-border animate-pulse" /> }
);

type Submission = {
  id: string;
  user_fingerprint: string;
  display_name: string;
  color: string;
  value: string;
  confidence: number;
  status: "proposed" | "dismissed" | "accepted";
  updated_at: string;
};

type AnswerGroup = {
  value_normalized: string;
  display_value: string;
  agreer_count: number;
  avg_confidence: number;
  team_confidence: number;
  submissions: Array<{
    fingerprint: string;
    name: string;
    color: string;
    confidence: number;
    submission_id: string;
  }>;
};

type Strike = { id: string; submission_id: string; user_fingerprint: string };

type DiscussionMsg = {
  id: string;
  user_fingerprint: string;
  display_name: string;
  color: string;
  body: string;
  created_at: string;
};

export function QuestionCard({
  question,
  me,
  csrfFetch,
  onRemoved,
}: {
  question: Question;
  me: Me;
  csrfFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRemoved: () => void;
}) {
  const [expanded, setExpanded] = useState(question.status !== "solved");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [groups, setGroups] = useState<AnswerGroup[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [showDiscuss, setShowDiscuss] = useState(false);

  const mySubmission = submissions.find((s) => s.user_fingerprint === me.fingerprint);

  const loadAnswers = useCallback(async () => {
    const res = await fetch(apiPath(`/api/answers?question_id=${question.id}`));
    if (!res.ok) return;
    const data = (await res.json()) as {
      submissions: Submission[];
      groups: AnswerGroup[];
      strikes: Strike[];
    };
    setSubmissions(data.submissions);
    setGroups(data.groups);
    setStrikes(data.strikes);
  }, [question.id]);

  useEffect(() => { loadAnswers(); }, [loadAnswers]);

  // live-update when other users submit/change/strike
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`q:${question.id}:answers`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answer_submissions", filter: `question_id=eq.${question.id}` },
        () => loadAnswers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answer_strikes" },
        () => loadAnswers()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [question.id, loadAnswers]);

  async function submitAnswer(value: string, confidence: number) {
    await csrfFetch("/api/answers", {
      method: "PUT",
      body: JSON.stringify({ question_id: question.id, value, confidence }),
    });
  }

  async function clearMyAnswer() {
    await csrfFetch(`/api/answers?question_id=${question.id}`, { method: "DELETE" });
  }

  async function toggleStrike(submissionId: string) {
    await csrfFetch("/api/answers/strike", {
      method: "POST",
      body: JSON.stringify({ submission_id: submissionId }),
    });
  }

  async function lockAnswer(value: string) {
    await csrfFetch("/api/answers/lock", {
      method: "POST",
      body: JSON.stringify({ question_id: question.id, value }),
    });
  }

  async function patchQuestion(patch: Record<string, unknown>) {
    await csrfFetch(`/api/questions/${question.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  async function removeQuestion() {
    if (!window.confirm("Delete this question?")) return;
    const res = await csrfFetch(`/api/questions/${question.id}`, { method: "DELETE" });
    if (res.ok) onRemoved();
  }

  const topGroup = groups.slice().sort((a, b) => b.team_confidence - a.team_confidence)[0];
  const canLock = topGroup && topGroup.team_confidence >= 75 && topGroup.display_value;

  return (
    <article className="panel card-glow transition-colors">
      {/* meta row */}
      <header className="px-3 py-2 border-b border-border flex items-center gap-3 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-text-secondary hover:text-accent-cyan"
          aria-label={expanded ? "collapse" : "expand"}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span
          className="status-dot"
          style={{ background: STATUS_COLOR[question.status] }}
          title={STATUS_LABEL[question.status]}
        />
        <StatusPicker status={question.status} onChange={(s) => patchQuestion({ status: s })} />
        <span className="text-text-dim">·</span>
        <span className="uppercase tracking-wider text-[10px] text-text-dim">
          {DIFFICULTY_LABEL[question.difficulty]}
        </span>
        <label className="flex items-center gap-1 text-text-dim ml-2">
          pts
          <input
            type="number"
            min={0}
            max={10000}
            defaultValue={question.points}
            onBlur={(e) => patchQuestion({ points: Number(e.target.value) || 0 })}
            className="w-14 bg-bg-deep border border-border px-1.5 py-0.5 text-text-primary text-[11px] font-mono"
          />
        </label>
        <div className="ml-auto flex items-center gap-1">
          <ClaimButton question={question} me={me} onToggle={(c) => patchQuestion({ claim: c })} />
          <button
            type="button"
            onClick={() => setShowDiscuss((v) => !v)}
            className="text-text-secondary hover:text-accent-cyan p-1"
            title="discussion"
          >
            <MessageSquare size={12} />
          </button>
          <button
            type="button"
            onClick={removeQuestion}
            className="text-text-secondary hover:text-accent-red p-1"
            title="delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* prompt */}
          <div>
            <Label>Prompt</Label>
            <div className="mt-1 bg-bg-deep border border-border px-2 py-1.5 min-h-[2.25rem] text-[13px]">
              <CollabEditor
                questionId={question.id}
                field="prompt"
                placeholder="paste the challenge prompt here…"
                user={{ name: me.display_name, color: me.color }}
              />
            </div>
          </div>

          {/* team notes */}
          <div>
            <Label>Team notes / scratchpad</Label>
            <div className="mt-1 bg-bg-deep border border-border px-2 py-1.5 min-h-[3rem] text-[13px]">
              <CollabEditor
                questionId={question.id}
                field="notes"
                placeholder="working notes, partial findings, useful commands…"
                user={{ name: me.display_name, color: me.color }}
              />
            </div>
          </div>

          {/* answer voting */}
          <AnswerSection
            question={question}
            me={me}
            submissions={submissions}
            groups={groups}
            strikes={strikes}
            onSubmit={submitAnswer}
            onClearMine={clearMyAnswer}
            onStrike={toggleStrike}
            onLock={lockAnswer}
            mySubmission={mySubmission}
            canLock={Boolean(canLock)}
            topGroupValue={topGroup?.display_value ?? ""}
          />

          {/* locked answer view */}
          {question.status === "solved" && question.flag && (
            <div className="px-3 py-2 border border-accent-green/50 bg-accent-green/5 flex items-center gap-3 font-mono text-xs">
              <Lock size={12} className="text-accent-green" />
              <span className="text-text-dim">locked:</span>
              <span className="text-accent-green">{question.flag}</span>
              {question.solved_at && (
                <span className="ml-auto text-[10px] text-text-dim">
                  {relTime(question.solved_at)}
                </span>
              )}
            </div>
          )}

          {showDiscuss && <Discussion questionId={question.id} roomId={me.room_id} me={me} csrfFetch={csrfFetch} />}
        </div>
      )}
    </article>
  );
}

// ---------- answer voting ----------

function AnswerSection({
  question,
  me,
  submissions,
  groups,
  strikes,
  onSubmit,
  onClearMine,
  onStrike,
  onLock,
  mySubmission,
  canLock,
  topGroupValue,
}: {
  question: Question;
  me: Me;
  submissions: Submission[];
  groups: AnswerGroup[];
  strikes: Strike[];
  onSubmit: (value: string, confidence: number) => Promise<void>;
  onClearMine: () => Promise<void>;
  onStrike: (submissionId: string) => Promise<void>;
  onLock: (value: string) => Promise<void>;
  mySubmission?: Submission;
  canLock: boolean;
  topGroupValue: string;
}) {
  const [value, setValue] = useState(mySubmission?.value ?? "");
  const [confidence, setConfidence] = useState<number>(mySubmission?.confidence ?? 70);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(mySubmission?.value ?? "");
    setConfidence(mySubmission?.confidence ?? 70);
  }, [mySubmission?.id]);

  const strikesBySub = strikes.reduce<Record<string, number>>((acc, s) => {
    acc[s.submission_id] = (acc[s.submission_id] ?? 0) + 1;
    return acc;
  }, {});

  const sortedGroups = groups.slice().sort((a, b) => b.team_confidence - a.team_confidence);
  const leader = sortedGroups[0];

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    await onSubmit(value.trim(), confidence);
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>Team confidence</Label>
        {leader ? (
          <span className="font-mono text-[11px] text-text-dim">
            leader: <span style={{ color: confidenceColor(leader.team_confidence) }}>
              {leader.display_value}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[11px] text-text-dim">no answers submitted yet</span>
        )}
        {canLock && question.status !== "solved" && (
          <Button
            size="sm"
            variant="green"
            className="ml-auto"
            onClick={() => onLock(topGroupValue)}
          >
            <Lock size={12} /> Lock as final
          </Button>
        )}
      </div>

      {leader && (
        <ConfidenceBar value={leader.team_confidence} label={`${leader.agreer_count} agree`} />
      )}

      {/* submission grid */}
      {sortedGroups.length > 0 && (
        <div className="space-y-1 font-mono text-[12px]">
          {sortedGroups.map((g) => (
            <div key={g.value_normalized} className="border border-border">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-bg-elevated">
                <span
                  className="truncate flex-1"
                  style={{ color: confidenceColor(g.team_confidence) }}
                >
                  {g.display_value || <em className="text-text-dim">(empty)</em>}
                </span>
                <span className="text-[10px] text-text-dim">
                  {g.agreer_count} vote{g.agreer_count === 1 ? "" : "s"}
                </span>
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: confidenceColor(g.team_confidence) }}
                >
                  {Math.round(g.team_confidence)}%
                </span>
              </div>
              <ul className="px-2 py-1 space-y-0.5">
                {g.submissions.map((s) => {
                  const strikeCount = strikesBySub[s.submission_id] ?? 0;
                  const mine = s.fingerprint === me.fingerprint;
                  return (
                    <li
                      key={s.submission_id}
                      className={`flex items-center gap-2 text-[11px] ${
                        strikeCount >= 2 ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <span className="status-dot" style={{ background: s.color }} />
                      <span className={mine ? "text-accent-cyan" : "text-text-primary"}>
                        {s.name}{mine && " (you)"}
                      </span>
                      <span className="text-text-dim">· {s.confidence}%</span>
                      {!mine && (
                        <button
                          type="button"
                          onClick={() => onStrike(s.submission_id)}
                          className="ml-auto text-text-dim hover:text-accent-red"
                          title={strikeCount > 0 ? `${strikeCount} strike${strikeCount === 1 ? "" : "s"}` : "mark as wrong"}
                        >
                          <ShieldX size={11} />
                          {strikeCount > 0 && <span className="ml-1 text-[10px]">{strikeCount}</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* your submission */}
      <div className="border border-border p-2 space-y-2 bg-bg-deep/60">
        <div className="flex items-center gap-2">
          <span className="status-dot" style={{ background: me.color }} />
          <Label className="text-accent-cyan">Your answer</Label>
          {mySubmission && (
            <button
              type="button"
              onClick={() => onClearMine()}
              className="ml-auto text-[10px] text-text-dim hover:text-accent-red flex items-center gap-1"
              title="clear your vote"
            >
              <X size={10} /> clear
            </button>
          )}
        </div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. flag{wh4t_a_w0rld}"
          className="text-accent-green"
        />
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
            confidence
          </span>
          <Slider
            value={[confidence]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => setConfidence(v[0] ?? 0)}
            className="flex-1"
          />
          <span
            className="font-mono text-[11px] tabular-nums min-w-[3ch] text-right"
            style={{ color: confidenceColor(confidence) }}
          >
            {confidence}%
          </span>
          <Button size="sm" variant="primary" onClick={save} disabled={saving || !value.trim()}>
            {saving ? "saving…" : mySubmission ? "update" : "submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- status picker ----------

function StatusPicker({
  status,
  onChange,
}: {
  status: Question["status"];
  onChange: (s: Question["status"]) => void;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as Question["status"])}
      className="bg-transparent text-text-primary font-mono text-[11px] focus:outline-none"
    >
      {(["not_started", "in_progress", "solved"] as const).map((s) => (
        <option key={s} value={s} className="bg-bg-panel">
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

// ---------- claim ----------

function ClaimButton({
  question,
  me,
  onToggle,
}: {
  question: Question;
  me: Me;
  onToggle: (claim: boolean) => void;
}) {
  const claimed = Boolean(question.claimed_by);
  // we don't have the member id on the client; assume claimed === claimed by someone.
  // the PATCH route looks up the caller's member id, so we pass a boolean.
  return (
    <button
      type="button"
      onClick={() => onToggle(!claimed)}
      className={`p-1 ${
        claimed ? "text-accent-cyan" : "text-text-secondary hover:text-accent-cyan"
      }`}
      title={claimed ? "release claim" : "claim (I'm working on it)"}
    >
      <Hand size={12} />
    </button>
  );
}

// ---------- discussion ----------

function Discussion({
  questionId,
  roomId,
  me,
  csrfFetch,
}: {
  questionId: string;
  roomId: string;
  me: Me;
  csrfFetch: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [messages, setMessages] = useState<DiscussionMsg[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(apiPath(`/api/discussion?question_id=${questionId}`));
      if (res.ok) {
        const data = (await res.json()) as { messages: DiscussionMsg[] };
        setMessages(data.messages);
      }
    }
    load();

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`q:${questionId}:chat`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discussion_messages", filter: `question_id=eq.${questionId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DiscussionMsg]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [questionId]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    await csrfFetch("/api/discussion", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, body: text }),
    });
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-text-dim mb-2">
        discussion
      </div>
      <ul className="space-y-1 max-h-48 overflow-y-auto scroll-thin font-mono text-[12px]">
        {messages.length === 0 && (
          <li className="text-[11px] text-text-dim">no messages yet — kick off the discussion</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="flex gap-2">
            <span className="status-dot mt-1.5 flex-none" style={{ background: m.color }} />
            <div>
              <span style={{ color: m.color }}>{m.display_name}</span>{" "}
              <span className="text-text-dim text-[10px]">{relTime(m.created_at)}</span>
              <div className="text-text-primary whitespace-pre-wrap">{m.body}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="type and hit enter…"
        />
        <Button size="sm" variant="primary" onClick={send} disabled={!body.trim()}>
          <Send size={12} />
        </Button>
      </div>
    </div>
  );
}
