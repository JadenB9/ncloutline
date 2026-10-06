import { CSRF_COOKIE } from "@/lib/auth/cookies";
import { apiPath } from "@/lib/api-path";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

// vercel edge-caches the landing html, so middleware never fires for a
// cached hit and the csrf cookie doesn't get seeded. if it's missing, poke
// a dynamic api route to trigger middleware, then re-read the cookie.
export async function ensureCsrf(): Promise<string> {
  let token = readCsrfCookie();
  if (token) return token;
  try {
    await fetch(apiPath("/api/me"), { credentials: "same-origin" });
  } catch {
    // network blip — fall through and let the caller get an empty string,
    // the server will 403 and the ui will show a retry message.
  }
  token = readCsrfCookie();
  return token ?? "";
}

// fetch one of our api routes with the base path and csrf header added
export async function csrfFetch(url: string, init: RequestInit = {}) {
  const csrf = await ensureCsrf();
  const headers = new Headers(init.headers ?? {});
  headers.set("x-csrf-token", csrf);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(apiPath(url), { ...init, headers });
}
