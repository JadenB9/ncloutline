"use client";

import {
  Code2, Fingerprint, Globe, Hash, KeyRound, Network, Plus, Radar, ScrollText, Terminal, Unlock, Wifi, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@/components/room/RoomShell";
import { CATEGORY_BY_KEY } from "@/lib/constants";

// named imports instead of `import * as Icons`, which shipped every lucide
// icon to the browser just to look up these ten by name
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Globe, KeyRound, Unlock, ScrollText, Network, Fingerprint, Radar, Code2, Terminal, Wifi,
};

function CategoryIcon({ section, size = 14 }: { section: Section; size?: number }) {
  const name = section.category_key ? CATEGORY_BY_KEY[section.category_key]?.icon : undefined;
  const Comp = (name && CATEGORY_ICONS[name]) || Hash;
  return <Comp size={size} />;
}

export function SectionList({
  sections,
  activeId,
  onSelect,
  onAdd,
  onRemove,
}: {
  sections: Section[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (s: Section) => void;
}) {
  const builtins = sections.filter((s) => !s.is_custom);
  const customs = sections.filter((s) => s.is_custom);

  return (
    <div className="py-2">
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-mono text-text-dim">
          categories
        </span>
      </div>
      <ul className="space-y-px">
        {builtins.map((s) => (
          <SectionRow
            key={s.id}
            section={s}
            active={s.id === activeId}
            onClick={() => onSelect(s.id)}
            icon={<CategoryIcon section={s} />}
          />
        ))}
      </ul>

      <div className="px-3 mt-4 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-mono text-text-dim">
          custom
        </span>
        <button
          className="text-text-secondary hover:text-accent-cyan"
          onClick={onAdd}
          title="Add custom section"
          aria-label="Add custom section"
        >
          <Plus size={12} />
        </button>
      </div>
      <ul className="space-y-px">
        {customs.map((s) => (
          <SectionRow
            key={s.id}
            section={s}
            active={s.id === activeId}
            onClick={() => onSelect(s.id)}
            icon={<Hash size={14} />}
            onRemove={() => onRemove(s)}
          />
        ))}
        {customs.length === 0 && (
          <li className="px-3 py-1 text-[11px] text-text-dim font-mono">
            no custom sections yet
          </li>
        )}
      </ul>
    </div>
  );
}

function SectionRow({
  section,
  active,
  onClick,
  icon,
  onRemove,
}: {
  section: Section;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "w-full text-left px-3 py-1.5 flex items-center gap-2 font-mono text-xs",
          active ? "bg-bg-elevated text-accent-cyan" : "text-text-primary hover:bg-bg-elevated"
        )}
      >
        <span className={cn("opacity-80", active && "opacity-100")}>{icon}</span>
        <span className="truncate">{section.name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 text-text-dim hover:text-accent-red"
          aria-label={`Delete ${section.name}`}
        >
          <X size={12} />
        </button>
      )}
    </li>
  );
}
