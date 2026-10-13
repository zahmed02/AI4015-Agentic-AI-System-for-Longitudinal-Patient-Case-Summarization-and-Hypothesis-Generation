"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { COLORS, OFFLINE_STEPS } from "@/lib/pipeline-data";
import { FlowConnector, TagChip } from "@/components/pipeline/shared";
import { cn } from "@/lib/utils";

export function OfflineSteps() {
  const [open, setOpen] = useState<string | null>(OFFLINE_STEPS[0].id);

  return (
    <div>
      {OFFLINE_STEPS.map((step, i) => {
        const Icon = step.icon;
        const color = COLORS[step.color];
        const isOpen = open === step.id;
        return (
          <div key={step.id}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden rounded-2xl border bg-background/50 transition-shadow"
              style={{
                borderColor: isOpen ? `${color}77` : undefined,
                boxShadow: isOpen ? `0 0 36px -14px ${color}` : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : step.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-4 p-4 text-left"
              >
                <span
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${color}66`, background: `${color}1a` }}
                >
                  <Icon className="size-5" style={{ color }} />
                  <span className="absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{step.title}</span>
                    {step.tags.map((t) => (
                      <TagChip key={t} tag={t} />
                    ))}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{step.summary}</span>
                </span>
                <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/70 px-4 pb-4 pt-3">
                      <p className="mb-3 font-mono text-xs" style={{ color }}>
                        {step.where}
                      </p>
                      <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
                        {step.rows.map((row) => (
                          <div key={row.label} className="contents">
                            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.label}</dt>
                            <dd className="text-sm leading-relaxed text-foreground/90">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {i < OFFLINE_STEPS.length - 1 && <FlowConnector label={step.handoff} color={color} />}
          </div>
        );
      })}
    </div>
  );
}