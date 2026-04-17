"use client";

import { createBrowserClient } from "@supabase/ssr";

// one browser client per tab. realtime auth is set after we read the jwt claims
// via /api/me so the client can subscribe under our room-scoped RLS policy.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}

// pass our app jwt so realtime + postgrest requests run under the room's RLS
export function setSupabaseAuthToken(token: string) {
  const c = getBrowserSupabase();
  c.realtime.setAuth(token);
  // the postgrest helper accepts a per-request header, but it's easier to
  // recreate the client with the token once we actually need it. keeping
  // realtime-authed is enough for listen-only use cases.
  return c;
}
