// cookie name constants, safe to import from anywhere. kept separate from
// jwt.ts so client components can reference them without dragging in
// lib/env (which validates server-only secrets and blows up in the browser).
export const JWT_COOKIE = "ncl_session";
export const CSRF_COOKIE = "ncl_csrf";

// in production the app lives at j4den.com/NCLtest, next to the rest of the
// site. scope our cookies to that path so the session isn't sent along with
// every other request to j4den.com.
export const COOKIE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";
