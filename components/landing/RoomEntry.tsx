"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ArrowRight } from "lucide-react";
import { BACKEND_ASLEEP_MSG, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/constants";
import { apiPath, inviteLink } from "@/lib/api-path";
import { ensureCsrf } from "@/lib/auth/csrf-client";

type Mode = "join" | "create";

function cleanCode(raw: string) {
  return raw
    .toUpperCase()
    .split("")
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .slice(0, ROOM_CODE_LENGTH)
    .join("");
}

// a gateway or platform error page isn't json, so res.json() can't be trusted
// on failures. 502-504 all mean the backend isn't answering.
async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.status >= 502 && res.status <= 504) return data?.error || BACKEND_ASLEEP_MSG;
  return data?.error || fallback;
}

/* Six fixed cells that render a room code. Interactive when an input overlays them. */
function CodeCells({
  value,
  activeIndex,
}: {
  value: string;
  activeIndex?: number;
}) {
  return (
    <div className="grid grid-cols-6 gap-2" aria-hidden>
      {Array.from({ length: ROOM_CODE_LENGTH }).map((_, i) => {
        const char = value[i] ?? "";
        const active = i === activeIndex;
        return (
          <div
            key={i}
            className={[
              "h-12 rounded-md border flex items-center justify-center font-mono text-lg transition-colors",
              char
                ? "border-border-strong bg-bg-elevated text-text-primary"
                : "border-border bg-bg-elevated/60 text-text-dim",
              active ? "border-accent-cyan shadow-glow" : "",
            ].join(" ")}
          >
            {char}
          </div>
        );
      })}
    </div>
  );
}

/* One real input drives the cells, so paste, backspace, and screen readers all work. */
function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative">
      <CodeCells
        value={value}
        activeIndex={
          focused ? Math.min(value.length, ROOM_CODE_LENGTH - 1) : undefined
        }
      />
      <input
        ref={inputRef}
        id="join-code"
        value={value}
        onChange={(e) => onChange(cleanCode(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full opacity-0 cursor-text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH}
        aria-label="Room code"
        required
      />
    </div>
  );
}

export function RoomEntry() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("join");

  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const [current, setCurrent] = useState<{ room_code: string; display_name: string } | null>(null);

  useEffect(() => {
    // an invite link (?code=ABC123) fills in the join form
    const fromLink = cleanCode(new URLSearchParams(window.location.search).get("code") ?? "");
    if (fromLink.length === ROOM_CODE_LENGTH) setCode(fromLink);

    // still holding a session from earlier? offer to go straight back instead
    // of joining again as a new member
    fetch(apiPath("/api/me"))
      .then((res) => (res.ok ? res.json() : null))
      .then((me: { room_code: string; display_name: string } | null) => {
        if (me) setCurrent(me);
      })
      .catch(() => {});
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setErr(null);
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== ROOM_CODE_LENGTH) {
      setErr("Room code must be 6 characters");
      return;
    }
    if (!displayName.trim()) {
      setErr("Display name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const csrf = await ensureCsrf();
      const res = await fetch(apiPath("/api/rooms/join"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          room_code: code,
          display_name: displayName.trim().slice(0, 32),
          token: token.trim() || null,
        }),
      });
      if (!res.ok) {
        setErr(await readError(res, "Invalid room code or password"));
        return;
      }
      router.push(`/room/${code}`);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setErr("Display name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const csrf = await ensureCsrf();
      const res = await fetch(apiPath("/api/rooms/create"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          display_name: displayName.trim().slice(0, 32),
          token: token.trim() || null,
        }),
      });
      if (!res.ok) {
        setErr(await readError(res, "Could not create room. Try again."));
        return;
      }
      const data = (await res.json()) as { room_code: string };
      setCreated(data.room_code);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(inviteLink(created));
      setCopied("yes");
    } catch {
      // clipboard can be blocked (permissions, embedded frames)
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 1500);
  }

  if (created) {
    return (
      <div className="panel shadow-soft p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Room created
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Share this code with your teammates
            {token ? " along with the password" : ""}.
          </p>
        </div>
        <div data-room-code={created}>
          <CodeCells value={created} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={copy}>
            {copied === "yes" ? <Check size={15} /> : <Copy size={15} />}
            {copied === "yes" ? "Link copied" : copied === "failed" ? "Copy failed" : "Copy invite link"}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => router.push(`/room/${created}`)}
          >
            Enter room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel shadow-soft p-6">
      {current && (
        <button
          type="button"
          onClick={() => router.push(`/room/${current.room_code}`)}
          className="w-full mb-5 flex items-center gap-3 rounded-lg border border-border bg-bg-elevated/60 px-3 py-2.5 text-left text-sm hover:border-border-strong"
        >
          <span className="flex-1 min-w-0 text-text-secondary">
            Back to room{" "}
            <span className="font-mono text-text-primary">{current.room_code}</span> as{" "}
            <span className="text-text-primary">{current.display_name}</span>
          </span>
          <ArrowRight size={15} className="flex-none text-accent-cyan" />
        </button>
      )}
      <div
        role="tablist"
        aria-label="Join or create a room"
        className="grid grid-cols-2 gap-1 rounded-lg bg-bg-deep p-1 mb-6"
      >
        {(["join", "create"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            id={`tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`panel-${m}`}
            onClick={() => switchMode(m)}
            className={[
              "h-9 rounded-md text-sm font-medium transition-colors",
              mode === m
                ? "bg-bg-elevated text-text-primary shadow-hard"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {m === "join" ? "Join a room" : "Create a room"}
          </button>
        ))}
      </div>

      {mode === "join" ? (
        <form onSubmit={onJoin} className="space-y-4" role="tabpanel" id="panel-join" aria-labelledby="tab-join">
          <div className="space-y-1.5">
            <Label htmlFor="join-code">Room code</Label>
            <CodeInput value={code} onChange={setCode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-name">Display name</Label>
            <Input
              id="join-name"
              maxLength={32}
              autoComplete="off"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What your team sees"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-token">Password</Label>
            <PasswordInput
              id="join-token"
              autoComplete="current-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Only if the room has one"
            />
          </div>
          {err && <p role="alert" className="text-[13px] text-accent-red">{err}</p>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            {busy ? "Joining…" : "Join room"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onCreate} className="space-y-4" role="tabpanel" id="panel-create" aria-labelledby="tab-create">
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Display name</Label>
            <Input
              id="create-name"
              autoComplete="off"
              maxLength={32}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What your team sees"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-token">Room password</Label>
            <PasswordInput
              id="create-token"
              autoComplete="new-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Optional — leave blank for an open room"
            />
          </div>
          {err && <p role="alert" className="text-[13px] text-accent-red">{err}</p>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            {busy ? "Creating…" : "Create room"}
          </Button>
        </form>
      )}
    </div>
  );
}
