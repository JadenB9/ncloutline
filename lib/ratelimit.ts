import { getAdminSupabase } from "@/lib/supabase/server";

export type RateLimitResult = { ok: boolean; bucket: string };

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
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max: opts.max,
    p_window_seconds: opts.windowSeconds,
  });
  if (error) {
    // fail-open so a DB blip doesn't lock everyone out. logged for ops.
    console.error("rate_limit_error", { bucket, error: error.message });
    return { ok: true, bucket };
  }
  return { ok: Boolean(data), bucket };
}

// dig the caller IP out of common proxy headers
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}
