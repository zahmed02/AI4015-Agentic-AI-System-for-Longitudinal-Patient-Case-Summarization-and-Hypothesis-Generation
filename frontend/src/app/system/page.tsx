"use client";

import { motion } from "framer-motion";
import { ArrowRight, Cpu, Database, Network, Plug, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { useSystemStatus } from "@/lib/hooks";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { ACCENTS, SECTION } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { ErrorState } from "@/components/common/states";
import { StatusDot } from "@/components/common/status-dot";
import { Skeleton } from "@/components/ui/skeleton";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function ServiceCard({ title, icon, ok, children }: { title: string; icon: LucideIcon; ok: boolean; children: React.ReactNode }) {
  return (
    <Panel title={title} icon={icon} accent={ACCENTS.rose} action={<StatusDot label={ok ? "Online" : "Offline"} state={ok ? "ok" : "down"} />}>
      {children}
    </Panel>
  );
}

export default function SystemPage() {
  const { data, isLoading, isError, error, refetch } = useSystemStatus();

  return (
    <>
      <PageHeader section={SECTION.system} />

      {isError && <ErrorState error={error} onRetry={() => refetch()} title="Could not read system status" />}
      {isLoading && <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}</div>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <ServiceCard title="FastAPI backend" icon={Cpu} ok>
              <Row label="Status" value={data.api} />
              <Row label="Primary model" value={`${data.llm.primary_provider} · ${data.llm.primary_model}`} />
              <Row label="Fallback model" value={`${data.llm.fallback_provider} · ${data.llm.fallback_model}`} />
            </ServiceCard>
            <ServiceCard title="ChromaDB" icon={Database} ok={data.chroma.ok}>
              <Row label="Collection" value={data.chroma.collection} />
              <Row label="Chunks / cases" value={`${data.chroma.chunks} / ${data.chroma.cases}`} />
              <Row label="Embeddings" value={data.chroma.embedding_model.split("/").pop()} />
              <Row label="Chunk size / overlap" value={`${data.chunking.chunk_size} / ${data.chunking.chunk_overlap}`} />
            </ServiceCard>
            <ServiceCard title="Neo4j knowledge graph" icon={Network} ok={data.neo4j.ok}>
              <Row label="Cases in graph" value={data.neo4j.cases} />
              <Row label="Relationships" value={data.neo4j.relationships} />
            </ServiceCard>
          </div>

          <Panel title="Agent pipeline" description="The Critic can send work back for another pass" icon={Repeat} accent={ACCENTS.emerald}>
            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
              {AGENT_ORDER.map((name, i) => {
                const a = AGENTS[name];
                const Icon = a.icon;
                return (
                  <div key={name} className="flex flex-1 flex-col items-stretch gap-3 lg:flex-row lg:items-center">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className={cn("flex-1 rounded-xl border p-4", a.border, a.bgSoft)}>
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn("size-5", a.text)} />
                        <p className="font-semibold">{a.label}</p>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.role}</p>
                    </motion.div>
                    {i < AGENT_ORDER.length - 1 && <ArrowRight className="mx-auto size-5 shrink-0 rotate-90 text-muted-foreground lg:rotate-0" />}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              <p className="rounded-lg border border-border bg-background/50 p-3">
                <span className="font-medium text-sky-300">Critic → Historian</span> when retrieval was insufficient. Retrieval is widened and the case filter is dropped.
              </p>
              <p className="rounded-lg border border-border bg-background/50 p-3">
                <span className="font-medium text-emerald-300">Critic → Diagnostician</span> when evidence linking or confidence is weak. The final round is always reviewed.
              </p>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Guardrails" description="Deterministic checks run before any agent is called" icon={ShieldCheck} accent={ACCENTS.rose}>
              <ul className="space-y-3 text-sm">
                <li className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="font-medium">Empty or oversized objective</p>
                  <p className="text-xs text-muted-foreground">Rejected above {data.guardrails.max_objective_length} characters.</p>
                </li>
                <li className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="font-medium">Instruction-override attempts</p>
                  <p className="text-xs text-muted-foreground">{data.guardrails.injection_patterns} patterns checked.</p>
                </li>
                <li className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="font-medium">Personal dosing and prescribing questions</p>
                  <p className="text-xs text-muted-foreground">{data.guardrails.prescribing_patterns} patterns checked.</p>
                </li>
                <li className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="font-medium">Clinical disclaimer</p>
                  <p className="text-xs text-muted-foreground">{data.guardrails.require_disclaimer ? "Appended to every report." : "Disabled in config.yaml."}</p>
                </li>
              </ul>
            </Panel>

            <Panel title="MCP tools" description="Exposed by src/mcp_server/server.py for MCP-compatible clients" icon={Plug} accent={ACCENTS.rose}>
              <ul className="space-y-2">
                {data.mcp_tools.map((t) => (
                  <li key={t.name} className="rounded-lg border border-border bg-background/50 p-3">
                    <p className="font-mono text-xs text-rose-300">{t.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}