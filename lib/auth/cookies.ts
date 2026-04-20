// cookie name constants, safe to import from anywhere. kept separate from
// jwt.ts so client components can reference them without dragging in
// lib/env (which validates server-only secrets and blows up in the browser).
export const JWT_COOKIE = "ncl_session";
export const CSRF_COOKIE = "ncl_csrf";
