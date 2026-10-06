import { cookies } from "next/headers";
import { JWT_COOKIE, verifySession, type SessionClaims } from "@/lib/auth/jwt";
import { csrfOk } from "@/lib/auth/csrf";
import { NextResponse } from "next/server";
import { BACKEND_ASLEEP_MSG } from "@/lib/constants";

// returns the session or a 401 response. also enforces CSRF on writes.
export async function requireSession(req: Request, opts?: { requireCsrf?: boolean }):
  Promise<{ ok: true; session: SessionClaims; token: string } | { ok: false; response: Response }> {
  if (opts?.requireCsrf !== false) {
    if (!csrfOk(req)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "bad csrf" }, { status: 403 }),
      };
    }
  }
  const token = cookies().get(JWT_COOKIE)?.value;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  const session = await verifySession(token);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "bad session" }, { status: 401 }) };
  }
  return { ok: true, session, token };
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// supabase-js reports network failures (paused project, DNS miss, timeout) as
// status 0 instead of throwing, and an unhealthy project answers with a 5xx
// from its gateway. either way the database isn't there.
export function dbUnreachable(res: { status: number }) {
  return res.status === 0 || res.status >= 502;
}

export function backendAsleep() {
  return NextResponse.json({ error: BACKEND_ASLEEP_MSG, code: "backend_asleep" }, { status: 503 });
}
