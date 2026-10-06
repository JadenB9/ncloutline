import { timingSafeEqual } from "crypto";
import { getAdminSupabase } from "@/lib/supabase/server";
import { dbUnreachable } from "@/lib/api/guard";

export type RateLimitResult = { ok: boolean; bucket: string; down?: boolean };

// sliding-window rate limiter backed by the rate_limit_events table +
// check_rate_limit() SQL function. runs on the server only (service role).
export async function rateLimit(opts: {
  key: string;       // bucket discriminator: "join", "create", etc.
  ip: string;        // client IP
  max: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const bucket = `${opts.key}:${opts.ip}`;
  const supabase = getAdminSupabase();
  const { data, error, status } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max: opts.max,
    p_window_seconds: opts.windowSeconds,
  });
  if (error) {
    // fail-open so a DB blip doesn't lock everyone out. logged for ops.
    // `down` lets the caller bail early when the whole database is gone.
    console.error("rate_limit_error", { bucket, error: error.message });
    return { ok: true, bucket, down: dbUnreachable({ status }) };
  }
  return { ok: Boolean(data), bucket };
}

// j4den.com reaches us through a cloudflare worker, so vercel only sees the
// worker's address and every visitor would land in the same rate-limit bucket.
// the worker can pass the real address in x-ncl-client-ip together with a
// shared secret. only trust it when the secret matches -- otherwise anyone
// hitting the vercel url directly could pick their own bucket.
function trustedProxyIp(req: Request): string | null {
  const secret = process.env.NCL_PROXY_SECRET;
  const sent = req.headers.get("x-ncl-proxy-secret");
  const ip = req.headers.get("x-ncl-client-ip");
  if (!secret || !sent || !ip) return null;
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return ip.trim();
}

// dig the caller IP out of common proxy headers
export function getClientIp(req: Request): string {
  const proxied = trustedProxyIp(req);
  if (proxied) return proxied;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}
