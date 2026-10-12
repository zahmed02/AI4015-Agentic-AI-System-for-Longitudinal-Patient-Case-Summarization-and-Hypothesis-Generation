"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Boxes, FolderOpen, GitFork, Network, Pill, Search, Stethoscope, Thermometer, type LucideIcon } from "lucide-react";
import { useEntitySearch, useGraphCase, useGraphStats } from "@/lib/hooks";
import { SECTION } from "@/lib/sections";
import { ENTITY_STYLES } from "@/lib/entities";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { EmptyState, ErrorState } from "@/components/common/states";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { EntityLists } from "@/components/graph/entity-lists";
import { CaseModal, useCaseModal } from "@/components/cases/case-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-card/80 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Icon className="size-4 text-violet-300" />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-violet-300">{value}</p>
    </div>
  );
}

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const stats = useGraphStats();
  const modal = useCaseModal();
  const viewerRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");

  const caseIds = stats.data?.case_ids ?? [];
  const activeCase = selected ?? caseIds[0] ?? null;
  const graphCase = useGraphCase(activeCase);
  const search = useEntitySearch(keyword);
  const accent = SECTION.graph.accent;

  const pickCase = (id: string) => {
    setSelected(id);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader section={SECTION.graph} />

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} title="Could not load the knowledge graph" />
      ) : stats.data && !stats.data.connected ? (
        <EmptyState
          icon={Network}
          title="Neo4j is not reachable"
          description={<>Start Docker Desktop, then run <code className="font-mono text-violet-300">docker compose up -d</code> from the project root.</>}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {stats.isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />) : (
              <>
                <Stat label="Cases" value={stats.data?.cases ?? 0} icon={FolderOpen} />
                <Stat label="Symptoms" value={stats.data?.symptoms ?? 0} icon={Thermometer} />
                <Stat label="Diagnoses" value={stats.data?.diagnoses ?? 0} icon={Stethoscope} />
                <Stat label="Treatments" value={stats.data?.treatments ?? 0} icon={Pill} />
                <Stat label="Relationships" value={stats.data?.relationships ?? 0} icon={GitFork} />
              </>
            )}
          </div>

          {stats.data && caseIds.length === 0 ? (
            <EmptyState
              icon={Network}
              title="The graph is empty"
              description={<>Build it with <code className="font-mono text-violet-300">python scripts\build_kg.py --case-id 48</code>. Each case costs one entity-extraction call.</>}
            />
          ) : (
            <>
              <div ref={viewerRef} className="scroll-mt-20">
                <Panel title="Graph cases" description="Select a case to draw its graph" icon={Boxes} accent={accent} bodyClassName="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {caseIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelected(id)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors",
                          id === activeCase ? [accent.bgSoft, accent.border, accent.text] : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <Panel
                  title={activeCase ? `Case ${activeCase}` : "Case graph"}
                  description="Relationships as stored in Neo4j"
                  icon={Network}
                  accent={accent}
                  action={
                    activeCase ? (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => modal.show(activeCase)}>
                        <FolderOpen className="size-4" /> Case record
                      </Button>
                    ) : undefined
                  }
                >
                  {graphCase.isLoading && <Skeleton className="h-[420px] w-full" />}
                  {graphCase.isError && <ErrorState error={graphCase.error} onRetry={() => graphCase.refetch()} />}
                  {graphCase.data && activeCase && <GraphCanvas caseId={activeCase} graph={graphCase.data} />}
                </Panel>

                <Panel title="Entities" description="Grouped by relationship type" icon={Boxes} accent={accent}>
                  {graphCase.data ? <EntityLists graph={graphCase.data} /> : <Skeleton className="h-64 w-full" />}
                </Panel>
              </div>

              <Panel title="Find entities across cases" description="Search symptoms, diagnoses and treatments, then jump to the cases that share them" icon={Search} accent={accent}>
                <form
                  className="flex gap-3"
                  onSubmit={(e) => { e.preventDefault(); setKeyword(draft.trim()); }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Entity keyword"
                    placeholder="Search entities, for example nitroglycerin"
                    className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet-400/60"
                  />
                  <Button type="submit" disabled={draft.trim().length < 2} className="gap-2 bg-violet-500 text-violet-950 hover:bg-violet-400">
                    <Search className="size-4" /> Search
                  </Button>
                </form>

                <div className="mt-4">
                  {search.isFetching && <Skeleton className="h-16 w-full" />}
                  {search.isError && <ErrorState error={search.error} />}
                  {search.data && !search.isFetching && (
                    search.data.hits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No entities match “{search.data.keyword}”.</p>
                    ) : (
                      <ul className="space-y-2">
                        {search.data.hits.map((hit, i) => (
                          <motion.li key={`${hit.entity_type}-${hit.entity_name}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{hit.entity_name}</p>
                              <p className="text-xs text-muted-foreground">{hit.entity_type}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {hit.case_ids.map((id) => (
                                <button key={id} type="button" onClick={() => pickCase(id)}
                                  className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-200 hover:bg-violet-500/20">
                                  Case {id}
                                </button>
                              ))}
                            </div>
                          </motion.li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </Panel>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {(Object.keys(ENTITY_STYLES) as (keyof typeof ENTITY_STYLES)[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: ENTITY_STYLES[k].hex }} />
                    {ENTITY_STYLES[k].label}
                    <span className="font-mono opacity-60">{ENTITY_STYLES[k].relation}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <CaseModal caseId={modal.caseId} open={modal.open} onClose={modal.close}
        onAnalyze={(id) => { modal.close(); router.push(`/analyze?case=${id}`); }} />
    </>
  );
}