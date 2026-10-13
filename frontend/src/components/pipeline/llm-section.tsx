"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info, Sparkles } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { FlowConnectorH } from "@/components/pipeline/shared";
import { useSystemStatus } from "@/lib/hooks";
import { ACCENTS } from "@/lib/sections";
import { CALL_STAGES, COLORS, NO_TOKEN_STEPS, TOUCHPOINTS } from "@/lib/pipeline-data";
import { cn } from "@/lib/utils";

const ROUNDS = [1, 2, 3, 4, 5, 6];
const MAX_CALLS = 18;

function CallAnatomy() {
  const reduce = useReducedMotion();
  const { data } = useSystemStatus();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % CALL_STAGES.length), 2400);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <Panel
      title="Inside every LLM call"
      description="The same five stages happen for the Historian, the Diagnostician, the Critic and the graph builder"
      icon={Sparkles}
      accent={ACCENTS.violet}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {CALL_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = active === i;
          const color = stage.owner === "Provider" ? COLORS.fuchsia : COLORS.sky;
          return (
            <div key={stage.id} className="flex flex-1 flex-col gap-2 md:flex-row md:items-stretch">
              <motion.div
                className="flex-1 rounded-2xl border bg-background/50 p-4"
                animate={{
                  borderColor: isActive ? `${color}cc` : "#15283d",
                  boxShadow: isActive ? `0 0 36px -12px ${color}` : "0 0 0px 0px #00000000",
                }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{ borderColor: `${color}66`, background: `${color}1a` }}>
                    <Icon className="size-[18px]" style={{ color }} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{stage.title}</p>
                    <p className="text-[11px] text-muted-foreground">{stage.owner}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{stage.text}</p>
                {stage.id === "provider" && data && (
                  <div className="mt-3 space-y-1 text-[11px]">
                    <p>Primary: <span className="font-mono text-cyan-300">{data.llm.primary_model}</span></p>
                    <p>Fallback: <span className="font-mono text-emerald-300">{data.llm.fallback_model}</span></p>
                  </div>
                )}
              </motion.div>
              {i < CALL_STAGES.length - 1 && (
                <div className="flex items-center justify-center md:px-1">
                  <FlowConnectorH color={color} className="w-6 md:w-8" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Touchpoints() {
  return (
    <Panel
      title="Where tokens are spent"
      description="Every LLM touchpoint in the project, with the size limits applied to its prompt"
      icon={Sparkles}
      accent={ACCENTS.violet}
      bodyClassName="space-y-5"
    >
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Step</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Calls</th>
              <th className="px-4 py-3 font-medium">What goes in</th>
              <th className="px-4 py-3 font-medium">Models</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TOUCHPOINTS.map((t, i) => (
              <motion.tr
                key={t.step}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{t.step}</span>
                  <span className={cn(
                    "ml-2 rounded-md border px-1.5 py-0.5 text-[10px]",
                    t.phase === "Analysis" ? "border-emerald-500/40 text-emerald-300" : "border-sky-500/40 text-sky-300",
                  )}>
                    {t.phase}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.when}</td>
                <td className="px-4 py-3 font-mono text-xs text-fuchsia-300">{t.calls}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.input}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.models}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">No tokens spent here</p>
        <div className="flex flex-wrap gap-2">
          {NO_TOKEN_STEPS.map((s) => (
            <span key={s} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200">{s}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-indigo-300" />
        ChronoMed does not record token counts. Usage shows up in your Gemini and Groq dashboards, where free-tier
        limits are applied. This page shows which steps spend tokens and how large their prompts can be.
      </div>
    </Panel>
  );
}

function CallsPerAnalysis() {
  return (
    <Panel
      title="LLM calls per analysis"
      description="Always one Historian, one Diagnostician and one Critic call at minimum. Revisions add more."
      icon={Sparkles}
      accent={ACCENTS.violet}
      bodyClassName="space-y-3"
    >
      {ROUNDS.map((n, i) => {
        const max = 3 * n;
        return (
          <div key={n} className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-3 text-xs">
            <span className="text-muted-foreground">{n} round{n > 1 ? "s" : ""}</span>
            <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-amber-400/50"
                initial={{ width: 0 }}
                whileInView={{ width: `${(max / MAX_CALLS) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.07 }}
              />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${(3 / MAX_CALLS) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.07 }}
              />
            </div>
            <span className="text-right font-mono">{n === 1 ? "3" : `3 to ${max}`}</span>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-400" /> Always: Historian, Diagnostician and Critic once each</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-amber-400/60" /> Possible extra calls from revisions</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The minimum is 3, when the first review approves. Sending work back to the Diagnostician adds 2 calls per extra
        round. Sending it back to the Historian adds 3, so the maximum is 3 calls times the number of rounds.
      </p>
    </Panel>
  );
}

export function LlmSection() {
  return (
    <div className="space-y-6">
      <CallAnatomy />
      <Touchpoints />
      <CallsPerAnalysis />
    </div>
  );
}