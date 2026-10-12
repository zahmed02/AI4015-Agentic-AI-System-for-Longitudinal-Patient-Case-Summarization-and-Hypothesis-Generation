"use client";

import { motion } from "framer-motion";
import { ENTITY_STYLES, type EntityKey } from "@/lib/entities";
import { cn } from "@/lib/utils";
import type { GraphEntities } from "@/lib/types";

export function entityGroups(graph: GraphEntities): { key: EntityKey; items: string[] }[] {
  return [
    { key: "confirmed", items: graph.confirmed_diagnoses },
    { key: "differential", items: graph.differential_diagnoses },
    { key: "symptoms", items: graph.symptoms },
    { key: "treatments", items: graph.treatments },
  ];
}

export function EntityLists({ graph }: { graph: GraphEntities }) {
  return (
    <div className="space-y-4">
      {entityGroups(graph).map(({ key, items }) => {
        const style = ENTITY_STYLES[key];
        const Icon = style.icon;
        return (
          <div key={key}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className={cn("size-4", style.text)} />
              <span className={cn("text-xs font-semibold uppercase tracking-wider", style.text)}>{style.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">None recorded for this case.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                  <motion.span
                    key={`${item}-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn("rounded-lg border px-2.5 py-1 text-xs", style.pill)}
                  >
                    {item}
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}