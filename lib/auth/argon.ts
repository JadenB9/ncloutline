import { hash, verify } from "@node-rs/argon2";

// argon2id is the recommended variant for password-ish data.
// params tuned for interactive login latency without shredding a Vercel fn.
const OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashToken(token: string): Promise<string> {
  return hash(token, OPTS);
}

export async function verifyToken(tokenHash: string, token: string): Promise<boolean> {
  try {
    return await verify(tokenHash, token);
  } catch {
    return false;
  }
}
