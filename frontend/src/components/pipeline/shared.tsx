"use client";

import { motion } from "framer-motion";
import { TAGS, type Tag } from "@/lib/pipeline-data";
import { cn } from "@/lib/utils";

export function TagChip({ tag }: { tag: Tag }) {
  const t = TAGS[tag];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", t.className)}>
      {t.short}
    </span>
  );
}

/** Vertical connector with a light that travels from top to bottom. */
export function FlowConnector({ label, color = "#22d3ee", className }: { label?: string; color?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 pl-[22px]", className)}>
      <div className="relative h-12 w-0.5 overflow-hidden rounded-full bg-border">
        <motion.span
          className="absolute left-0 top-0 h-4 w-full rounded-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${color})`, boxShadow: `0 0 10px ${color}` }}
          animate={{ y: [-16, 48] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

/** Horizontal connector with a light that travels left to right. */
export function FlowConnectorH({ color = "#22d3ee", className }: { color?: string; className?: string }) {
  return (
    <div className={cn("relative h-0.5 w-10 overflow-hidden rounded-full bg-border", className)}>
      <motion.span
        className="absolute inset-y-0 left-0 w-4 rounded-full"
        style={{ background: `linear-gradient(to right, transparent, ${color})`, boxShadow: `0 0 10px ${color}` }}
        animate={{ x: [-16, 40] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}