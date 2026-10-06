import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { COOKIE_PATH, CSRF_COOKIE, JWT_COOKIE } from "@/lib/auth/cookies";

// re-export for server-side callers that used to import these from jwt.ts
export { CSRF_COOKIE, JWT_COOKIE };

// jwt must be signed with Supabase's JWT secret so auth.jwt() in RLS policies
// can read our custom claims (room_id, fingerprint, display_name).

const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
const ALG = "HS256";
const TWENTY_FOUR_HOURS = 60 * 60 * 24;

export type SessionClaims = {
  room_id: string;
  room_code: string;
  fingerprint: string;
  display_name: string;
  color: string;
  // role is required for supabase auth.role() to not reject. 'authenticated'
  // is what the Supabase Auth service would normally stamp.
  role: "authenticated";
};

export async function signSession(claims: Omit<SessionClaims, "role">) {
  return new SignJWT({ ...claims, role: "authenticated" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("24h")
    .setSubject(claims.fingerprint)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export const JWT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: COOKIE_PATH,
  maxAge: TWENTY_FOUR_HOURS,
};
