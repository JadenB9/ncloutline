import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// a paused or unreachable project should fail fast instead of hanging the
// route until vercel kills the function
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) });
}

// admin client for anything that needs to bypass RLS (room creation,
// server-side answer aggregation, rate limit table writes). Never send
// this client to the browser.
export function getAdminSupabase() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
