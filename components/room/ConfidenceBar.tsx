"use client";

import { confidenceColor } from "@/lib/constants";

export function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = confidenceColor(clamped);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-deep border border-border relative overflow-hidden">
        <div
          className="h-full transition-[width,background-color] duration-300"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span
        className="font-mono text-[10px] tabular-nums min-w-[3ch] text-right"
        style={{ color }}
      >
        {clamped}%
      </span>
      {label && <span className="font-mono text-[10px] text-text-dim">{label}</span>}
    </div>
  );
}
