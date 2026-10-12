"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/sections";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  accent: Accent;
  layoutId: string;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange, accent, layoutId }: Props<T>) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background/60 p-1">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              selected ? accent.text : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 rounded-lg border", accent.bgSoft, accent.border)}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            {Icon && <Icon className="relative z-10 size-4" />}
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="relative z-10 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}