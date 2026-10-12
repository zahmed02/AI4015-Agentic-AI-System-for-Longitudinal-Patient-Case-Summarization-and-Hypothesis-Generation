"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { pct } from "@/lib/format";
import type { JobEvent } from "@/lib/types";

export function PipelineStepper({
  events, currentStage, running,
}: { events: JobEvent[]; currentStage: string | null; running: boolean }) {
  const revisions = events.filter((e) => e.agent === "critic" && e.data.approved === false).length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {AGENT_ORDER.map((name) => {
          const agent = AGENTS[name];
          const Icon = agent.icon;
          const passes = events.filter((e) => e.agent === name).length;
          const active = running && currentStage === name;
          const done = passes > 0 && !active;
          return (
            <motion.div
              key={name}
              layout
              className={cn(
                "rounded-xl border p-4 transition-colors",
                active ? [agent.border, agent.bgSoft, agent.glow] : done ? "border-border bg-secondary/40" : "border-border/60 bg-card/40 opacity-70",
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn("flex size-9 items-center justify-center rounded-lg border", agent.bgSoft, agent.border)}>
                  <Icon className={cn("size-[18px]", agent.text)} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{agent.label}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {active ? (<><Loader2 className="size-3 animate-spin" /> Working</>)
                      : done ? (<><Check className="size-3 text-emerald-400" /> {passes} pass{passes > 1 ? "es" : ""}</>)
                      : "Waiting"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{agent.role}</p>
            </motion.div>
          );
        })}
      </div>
      {revisions > 0 && (
        <p className="mt-3 text-xs text-amber-300">
          {revisions} revision round{revisions > 1 ? "s" : ""} requested by the Critic so far.
        </p>
      )}
    </div>
  );
}

function EventDetail({ event }: { event: JobEvent }) {
  if (event.agent === "diagnostician") {
    const hyps = (event.data.hypotheses as { diagnosis: string; confidence: number }[] | undefined) ?? [];
    return (
      <ul className="mt-2 space-y-1">
        {hyps.map((h, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-foreground/90">{h.diagnosis}</span>
            <span className="font-mono text-emerald-300">{pct(h.confidence)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (event.agent === "critic") {
    const issues = (event.data.issues as string[] | undefined) ?? [];
    const feedback = event.data.feedback as string | undefined;
    return (
      <div className="mt-2 space-y-2">
        {issues.length > 0 && (
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-200/90">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                {issue}
              </li>
            ))}
          </ul>
        )}
        {feedback && <p className="text-xs italic text-muted-foreground">{feedback}</p>}
      </div>
    );
  }
  return null;
}

export function TraceList({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Waiting for the first agent to report.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      <AnimatePresence initial={false}>
        {events.map((event) => {
          const agent = AGENTS[event.agent];
          const Icon = agent.icon;
          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <span className={cn("absolute -left-[37px] top-0 flex size-6 items-center justify-center rounded-full border bg-card", agent.border)}>
                <Icon className={cn("size-3", agent.text)} />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <span className="font-mono text-[11px] text-muted-foreground">t+{event.t}s</span>
              </div>
              <p className={cn("text-xs", agent.text)}>{agent.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              <EventDetail event={event} />
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}