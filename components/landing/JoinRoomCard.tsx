"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LogIn, ArrowRight } from "lucide-react";
import { CSRF_COOKIE } from "@/lib/auth/cookies";
import { ROOM_CODE_LENGTH } from "@/lib/constants";
import { apiPath } from "@/lib/api-path";

function readCsrf() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

export function JoinRoomCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) {
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
      const csrf = readCsrf();
      const res = await fetch(apiPath("/api/rooms/join"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({
          room_code: clean,
          display_name: displayName.trim().slice(0, 32),
          token: token.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(data.error || "Invalid room code or token");
        return;
      }
      router.push(`/room/${clean}`);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent-green">
        <LogIn size={14} />
        <span className="font-mono">join room</span>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="join-code">Room code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A3X9K7"
              maxLength={ROOM_CODE_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 uppercase tracking-[0.3em] text-center"
              required
            />
          </div>
          <div>
            <Label htmlFor="join-name">Display name</Label>
            <Input
              id="join-name"
              maxLength={32}
              autoComplete="off"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="user@team"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="join-token">Password (if required)</Label>
            <PasswordInput
              id="join-token"
              autoComplete="current-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="optional"
              className="mt-1"
            />
          </div>
          {err && <p className="text-xs text-accent-red font-mono">! {err}</p>}
          <Button type="submit" variant="green" size="lg" className="w-full" disabled={busy}>
            {busy ? "connecting…" : "Join Room"}
            {!busy && <ArrowRight size={16} />}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
