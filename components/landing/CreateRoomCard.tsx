"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Terminal, Copy, ArrowRight, Check } from "lucide-react";
import { apiPath } from "@/lib/api-path";
import { ensureCsrf } from "@/lib/auth/csrf-client";

export function CreateRoomCard() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
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
      const data = (await res.json()) as { room_code?: string; error?: string };
      if (!res.ok || !data.room_code) {
        setErr(data.error || "Could not create room. Try again.");
        return;
      }
      setCreated(data.room_code);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function enter() {
    if (created) router.push(`/room/${created}`);
  }

  if (created) {
    return (
      <Card className="h-full">
        <CardHeader className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent-cyan">
          <Terminal size={14} />
          <span className="font-mono">room provisioned</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-text-secondary">
            Share this code with teammates. Anyone with the code {token ? "and password " : ""}can join.
          </p>
          <div className="flex items-stretch border border-accent-cyan bg-bg-deep">
            <div className="flex-1 font-mono text-3xl tracking-[0.4em] text-accent-cyan px-4 py-3 text-center">
              {created}
            </div>
            <button
              type="button"
              onClick={copy}
              className="px-3 border-l border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-bg-deep"
              aria-label="Copy room code"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <Button variant="green" size="lg" className="w-full" onClick={enter}>
            Enter Room <ArrowRight size={16} />
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent-cyan">
        <Terminal size={14} />
        <span className="font-mono">create room</span>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="create-name">Display name</Label>
            <Input
              id="create-name"
              autoComplete="off"
              maxLength={32}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="root@team"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="create-token">Room password (optional)</Label>
            <PasswordInput
              id="create-token"
              autoComplete="new-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="leave blank for open room"
              className="mt-1"
            />
            <p className="text-[11px] text-text-dim mt-1 font-mono">
              stored as argon2id hash. never logged. case-sensitive.
            </p>
          </div>
          {err && <p className="text-xs text-accent-red font-mono">! {err}</p>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            {busy ? "provisioning…" : "Create Room"}
            {!busy && <ArrowRight size={16} />}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
