import { randomBytes } from "crypto";
import { CSRF_COOKIE } from "@/lib/auth/jwt";

export const CSRF_HEADER = "x-csrf-token";

export function newCsrfToken() {
  return randomBytes(24).toString("base64url");
}

// double-submit cookie pattern: cookie value must match the x-csrf-token
// header on every non-GET request. server sets the cookie, client JS reads it
// from document.cookie and echoes it in the header on fetch.
export function csrfCookieOptions() {
  return {
    httpOnly: false, // JS needs to read this to echo the header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };
}

export function extractCsrfFromRequest(req: Request): { header: string | null; cookie: string | null } {
  const header = req.headers.get(CSRF_HEADER);
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${CSRF_COOKIE}=`));
  const cookie = match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
  return { header, cookie };
}

export function csrfOk(req: Request) {
  const { header, cookie } = extractCsrfFromRequest(req);
  return Boolean(header && cookie && header === cookie);
}
