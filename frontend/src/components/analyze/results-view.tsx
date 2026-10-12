"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, ClipboardList, FileSearch, ListChecks, Route, ShieldAlert, Stethoscope, Timer,
} from "lucide-react";
import { Panel } from "@/components/common/panel";
import { SegmentedTabs, type TabItem } from "@/components/common/segmented-tabs";
import { TraceList } from "@/components/analyze/agent-trace";
import { SECTION } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { cleanCaseTitle, confidenceTone, formatDuration, pct } from "@/lib/format";
import { parseTimeline, splitDisclaimer } from "@/lib/timeline";
import type { AnalysisResult, AnalysisStatus, Hypothesis, JobEvent } from "@/lib/types";

type TabId = "hypotheses" | "timeline" | "critic" | "evidence" | "trace";

const STATUS_STYLE: Record<AnalysisStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  APPROVED: { label: "Approved by the Critic", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", icon: CheckCircle2 },
  MAX_ITERATIONS_REACHED: { label: "Iteration limit reached", className: "border-amber-500/40 bg-amber-500/10 text-amber-300", icon: AlertTriangle },
  NOT_CONVERGED: { label: "Not converged", className: "border-red-500/40 bg-red-500/10 text-red-300", icon: ShieldAlert },
};

function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{p}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function HypothesisCard({ h, rank }: { h: Hypothesis; rank: number }) {
  const tone = confidenceTone(h.confidence);
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className={cn("rounded-2xl border bg-background/50 p-5", rank === 0 ? "border-emerald-500/40" : "border-border")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs", rank === 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border bg-secondary text-muted-foreground")}>
            {rank + 1}
          </span>
          <h3 className="text-base font-semibold leading-snug">{h.diagnosis}</h3>
        </div>
        <span className={cn("font-mono text-lg font-semibold", tone.text)}>{pct(h.confidence)}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn("h-full rounded-full bg-linear-to-r", tone.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(h.confidence * 100)}%` }}
          transition={{ duration: 0.8, delay: 0.15 + rank * 0.08, ease: "easeOut" }}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{h.reasoning}</p>

      {h.evidence.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p>
          <ul className="space-y-1.5">
            {h.evidence.map((e, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-emerald-400" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.citations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {h.citations.map((c) => (
            <span key={c} className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">{c}</span>
          ))}
        </div>
      )}
    </motion.article>
  );
}

function TimelineView({ text }: { text: string }) {
  const { body, disclaimer } = useMemo(() => splitDisclaimer(text), [text]);
  const sections = useMemo(() => parseTimeline(body), [body]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((s, i) => (
          <motion.section
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("rounded-xl border bg-background/50 p-4", s.documented ? "border-border" : "border-dashed border-border/70", s.title === "Treatment Given" || s.title === "Preliminary Diagnosis" ? "md:col-span-2" : "")}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[11px] text-sky-300">{String(i + 1).padStart(2, "0")}</span>
              <h4 className="text-sm font-semibold">{s.title}</h4>
            </div>
            {s.documented ? (
              <ul className="space-y-1.5">
                {s.lines.map((l, li) => (
                  <li key={li} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                    {l.bullet && <span className="mt-2 size-1 shrink-0 rounded-full bg-sky-400" />}
                    <span><Inline text={l.text} /></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-muted-foreground">Not documented in the retrieved excerpts.</p>
            )}
          </motion.section>
        ))}
      </div>
      {disclaimer && (
        <div className="flex gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />
          {disclaimer}
        </div>
      )}
    </div>
  );
}

function CriticView({ result }: { result: AnalysisResult }) {
  const limitReached = result.status === "MAX_ITERATIONS_REACHED" && result.critic_issues.length > 0;
  return (
    <div className="space-y-4">
      <div className={cn("flex gap-3 rounded-xl border p-4", limitReached ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5")}>
        {limitReached ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />}
        <div>
          <p className="text-sm font-semibold">
            {limitReached ? "Accepted at the iteration limit with open concerns" : "All hypotheses passed review"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{result.critic_feedback || "No further feedback."}</p>
        </div>
      </div>
      {result.critic_issues.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issues from the final review</p>
          <ul className="space-y-2">
            {result.critic_issues.map((issue, i) => (
              <li key={i} className="flex gap-2.5 rounded-lg border border-border bg-background/50 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface Props {
  result: AnalysisResult;
  events: JobEvent[];
  onOpenCase: (caseId: string) => void;
}

export function ResultsView({ result, events, onOpenCase }: Props) {
  const [tab, setTab] = useState<TabId>("hypotheses");
  const status = STATUS_STYLE[result.status];
  const StatusIcon = status.icon;

  const tabs: TabItem<TabId>[] = [
    { id: "hypotheses", label: "Hypotheses", icon: Stethoscope, count: result.hypotheses.length },
    { id: "timeline", label: "Timeline", icon: ClipboardList },
    { id: "critic", label: "Critic review", icon: ListChecks, count: result.critic_issues.length },
    { id: "evidence", label: "Evidence", icon: FileSearch, count: result.retrieved_chunks.length },
    { id: "trace", label: "Reasoning trace", icon: Route, count: events.length },
  ];

  return (
    <Panel accent={SECTION.analyze.accent} bodyClassName="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium", status.className)}>
          <StatusIcon className="size-4" /> {status.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Route className="size-3.5" /> {result.iterations_used} review round{result.iterations_used === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="size-3.5" /> {formatDuration(result.runtime_seconds)}
        </span>
      </div>

      <SegmentedTabs tabs={tabs} active={tab} onChange={setTab} accent={SECTION.analyze.accent} layoutId="results-tab" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "hypotheses" && (
            <div className="space-y-3">
              {result.hypotheses.length === 0 ? (
                <p className="text-sm text-muted-foreground">The Diagnostician did not return any hypotheses.</p>
              ) : (
                result.hypotheses.map((h, i) => <HypothesisCard key={h.diagnosis} h={h} rank={i} />)
              )}
            </div>
          )}
          {tab === "timeline" && <TimelineView text={result.clinical_timeline} />}
          {tab === "critic" && <CriticView result={result} />}
          {tab === "evidence" && (
            <div className="space-y-3">
              {result.retrieved_chunks.map((c) => (
                <div key={c.chunk_id} className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-sky-300">{c.chunk_id}</span>
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{c.specialty}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">distance {c.score.toFixed(3)}</span>
                    </div>
                    <button type="button" onClick={() => onOpenCase(c.case_id)} className="text-xs font-medium text-sky-300 hover:underline">
                      Open case {c.case_id}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{cleanCaseTitle(c.title)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{c.preview}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "trace" && <TraceList events={events} />}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}