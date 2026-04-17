import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { USER_COLORS } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// deterministic color per fingerprint so the same user gets the same cursor color across sessions
export function colorForFingerprint(fp: string) {
  let h = 0;
  for (let i = 0; i < fp.length; i++) h = (h * 31 + fp.charCodeAt(i)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length]!;
}

export function newFingerprint() {
  // 16 bytes of random expressed as a base36-ish string
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function relTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
