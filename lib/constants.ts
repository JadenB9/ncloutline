// unambiguous alphabet — no 0/O/1/I/L to avoid typos when dictating room codes
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

// user cursor colors. picked to contrast well against the dark UI.
export const USER_COLORS = [
  "#00E5FF", // cyan
  "#00FF88", // green
  "#FFB800", // amber
  "#FF3355", // red
  "#B388FF", // lavender (dim, used sparingly)
  "#FF7A45", // orange
  "#7DFFB7", // mint
  "#FFD166", // sand
];

export type DifficultyTier = "easy" | "medium" | "hard";
export const DIFFICULTIES: DifficultyTier[] = ["easy", "medium", "hard"];

export const DIFFICULTY_LABEL: Record<DifficultyTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

// the ten NCL category buckets. keyed so we can detect them vs custom sections
// and so the UI can attach a line-art icon to each.
export type NclCategory = {
  key: string;
  name: string;
  icon: string; // lucide-react icon name
  blurb: string;
};

export const NCL_CATEGORIES: NclCategory[] = [
  {
    key: "osint",
    name: "Open Source Intelligence",
    icon: "Globe",
    blurb:
      "Pull signals from public sources — social graphs, metadata, image geolocation, WHOIS, leaked records.",
  },
  {
    key: "crypto",
    name: "Cryptography",
    icon: "KeyRound",
    blurb:
      "Classic and modern ciphers, hash cracking, RSA side math, frequency analysis, stego payloads.",
  },
  {
    key: "password",
    name: "Password Cracking",
    icon: "Unlock",
    blurb:
      "Hashcat and John rulesets, wordlist strategy, rainbow tables, pattern spraying on dumps.",
  },
  {
    key: "log",
    name: "Log Analysis",
    icon: "ScrollText",
    blurb:
      "Apache/nginx access logs, auth logs, SIEM extracts — correlate timestamps, user agents, anomalies.",
  },
  {
    key: "network",
    name: "Network Traffic Analysis",
    icon: "Network",
    blurb:
      "PCAP forensics in Wireshark / tshark — follow streams, carve files, decode protocols, spot C2.",
  },
  {
    key: "forensics",
    name: "Forensics",
    icon: "Fingerprint",
    blurb:
      "Disk images, memory dumps, file carving, steganography, deleted artifact recovery.",
  },
  {
    key: "recon",
    name: "Scanning & Reconnaissance",
    icon: "Radar",
    blurb:
      "Nmap, masscan, banner grabbing, passive DNS, cert transparency, asset discovery.",
  },
  {
    key: "web",
    name: "Web Application Exploitation",
    icon: "Code2",
    blurb:
      "XSS, SQLi, SSRF, IDOR, prototype pollution, JWT attacks, file upload chains.",
  },
  {
    key: "enum",
    name: "Enumeration & Exploitation",
    icon: "Terminal",
    blurb:
      "Service fingerprinting, CVE matching, privilege escalation paths, payload crafting.",
  },
  {
    key: "wireless",
    name: "Wireless Access Exploitation",
    icon: "Wifi",
    blurb:
      "WPA2/WPA3 handshakes, PMKID, rogue AP, deauth, 802.11 packet analysis.",
  },
];

export const CATEGORY_BY_KEY: Record<string, NclCategory> = Object.fromEntries(
  NCL_CATEGORIES.map((c) => [c.key, c])
);

export const STATUS_LABEL = {
  not_started: "Not Started",
  in_progress: "In Progress",
  solved: "Solved",
} as const;

export const STATUS_COLOR = {
  not_started: "#5A6679",
  in_progress: "#FFB800",
  solved: "#00FF88",
} as const;

export type QuestionStatus = keyof typeof STATUS_LABEL;

// confidence bar color stops
export function confidenceColor(pct: number) {
  if (pct < 33) return "#FF3355";
  if (pct < 66) return "#FFB800";
  return "#00FF88";
}
