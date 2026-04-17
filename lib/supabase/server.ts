import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// cookie-bound server client for route handlers and server components.
// we don't use Supabase Auth; this is here so realtime/postgrest work
// if we ever want to pass our own JWT alongside.
export function getRouteSupabase() {
  const cookieStore = cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

// admin client for anything that needs to bypass RLS (room creation,
// server-side answer aggregation, rate limit table writes). Never send
// this client to the browser.
export function getAdminSupabase() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// room-scoped client: passes a user jwt so RLS policies apply.
// used from route handlers when we want to perform a write as the user.
export function getAuthedSupabase(jwt: string) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
