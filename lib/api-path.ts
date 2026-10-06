// client-side fetches don't auto-prefix basePath the way <Link> does, so
// every `/api/...` call has to be prefixed manually when the app is served
// under j4den.com/NCLtest.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function apiPath(path: string): string {
  return `${BASE}${path}`;
}

// shareable link to the landing page with the join code filled in
export function inviteLink(code: string): string {
  return `${window.location.origin}${BASE || "/"}?code=${code}`;
}
