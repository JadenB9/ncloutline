import { NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE } from "@/lib/auth/jwt";

// edge middleware. sets strict security headers and seeds the CSRF cookie.
// supabase realtime URL must be in connect-src or the websocket is blocked.

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  } catch {
    return "";
  }
})();

const SUPABASE_WS =
  SUPABASE_ORIGIN.replace(/^http/, "ws") || "";

function buildCsp() {
  const directives = [
    "default-src 'self'",
    // next.js needs unsafe-inline for small style injection. unsafe-eval only in dev for HMR.
    `script-src 'self' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""} 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`.trim(),
    "frame-ancestors 'self' https://j4den.com https://*.j4den.com",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set("Content-Security-Policy", buildCsp());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // served inside the j4den.com frame via reverse proxy, so DENY would break
  // the integration. SAMEORIGIN is already implied by frame-ancestors above.
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // seed the CSRF cookie if missing so client JS can echo it on writes
  const existing = req.cookies.get(CSRF_COOKIE);
  if (!existing) {
    res.cookies.set({
      name: CSRF_COOKIE,
      value: randomToken(),
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
