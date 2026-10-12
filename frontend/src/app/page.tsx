"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, FolderOpen, Layers, Network, Stethoscope, type LucideIcon } from "lucide-react";
import { useCases, useGraphStats, useSystemStatus } from "@/lib/hooks";
import { useHistory } from "@/lib/history";
import { ACCENTS, SECTION, type Accent } from "@/lib/sections";
import { formatDateTime, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";

function EcgLine() {
  return (
    <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="h-24 w-full text-cyan-400" aria-hidden>
      <motion.path
        d="M0 60 H120 L140 60 L155 20 L175 100 L195 40 L210 60 H330 L350 60 L365 20 L385 100 L405 40 L420 60 H600"
        fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: [0, 1, 1], opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

function StatCard({ label, value, icon: Icon, accent, loading, index }: {
  label: string; value: number | undefined; icon: LucideIcon; accent: Accent; loading: boolean; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}
      className={cn("rounded-2xl border bg-card/80 p-5", accent.border, accent.glow)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg border", accent.bgSoft, accent.border)}>
          <Icon className={cn("size-4", accent.text)} />
        </span>
      </div>
      {loading ? <Skeleton className="mt-3 h-9 w-20" /> : (
        <p className={cn("mt-3 font-mono text-3xl font-semibold", accent.text)}>{value ?? "–"}</p>
      )}
    </motion.div>
  );
}

export default function OverviewPage() {
  const status = useSystemStatus();
  const casesQuery = useCases();
  const graph = useGraphStats();
  const history = useHistory();

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of casesQuery.data?.cases ?? []) counts.set(c.specialty, (counts.get(c.specialty) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [casesQuery.data]);
  const max = distribution[0]?.[1] ?? 1;

  return (
    <>
      <PageHeader section={SECTION.dashboard} />

      {status.isError && <div className="mb-6"><ErrorState error={status.error} onRetry={() => status.refetch()} title="The backend is not reachable" /></div>}

      <Panel accent={ACCENTS.cyan} className="mb-6" bodyClassName="p-0">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Longitudinal case summarization and hypothesis generation
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              A Historian, Diagnostician and Critic agent work through retrieved MedChain case records. Every
              claim is checked against the evidence before a report is returned.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/analyze" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-400">
                <Stethoscope className="size-4" /> Analyze a case
              </Link>
              <Link href="/cases" className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20">
                <FolderOpen className="size-4" /> Browse cases
              </Link>
            </div>
          </div>
          <EcgLine />
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Indexed cases" value={status.data?.chroma.cases} icon={FolderOpen} accent={ACCENTS.sky} loading={status.isLoading} />
        <StatCard index={1} label="Text chunks" value={status.data?.chroma.chunks} icon={Layers} accent={ACCENTS.cyan} loading={status.isLoading} />
        <StatCard index={2} label="Specialties" value={status.data?.chroma.specialties} icon={Boxes} accent={ACCENTS.emerald} loading={status.isLoading} />
        <StatCard index={3} label="Cases in graph" value={graph.data?.cases} icon={Network} accent={ACCENTS.violet} loading={graph.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Cases by specialty" description="Distribution of the indexed corpus" icon={Boxes} accent={ACCENTS.sky}>
          {casesQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : distribution.length === 0 ? (
            <EmptyState title="No cases indexed" description="Run the ingestion scripts to index MedChain cases." />
          ) : (
            <ul className="space-y-3">
              {distribution.map(([name, count], i) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-foreground/90">{name}</span>
                    <span className="font-mono text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <motion.div className="h-full rounded-full bg-linear-to-r from-sky-400 to-blue-500"
                      initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: "easeOut" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent analyses" description="Saved in this browser" icon={Stethoscope} accent={ACCENTS.emerald}>
          {history.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No analyses yet" description="Completed analyses show up here."
              action={<Link href="/analyze" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:underline">Run your first analysis <ArrowRight className="size-4" /></Link>} />
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 5).map((e) => {
                const top = e.result.hypotheses[0];
                return (
                  <li key={e.job_id}>
                    <Link href={`/analyze?history=${e.job_id}`} className="block rounded-xl border border-border bg-background/50 p-3.5 transition-colors hover:border-emerald-400/50">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium">{e.objective}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(e.finished_at)}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {e.case_id ? `Case ${e.case_id}` : "Global search"}
                        {top && <> · <span className="text-emerald-300">{top.diagnosis}</span> ({pct(top.confidence)})</>}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}