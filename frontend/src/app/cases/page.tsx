"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, Network, Search } from "lucide-react";
import { useCases, useGraphStats } from "@/lib/hooks";
import { SECTION } from "@/lib/sections";
import { cleanCaseTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { EmptyState, ErrorState } from "@/components/common/states";
import { CaseModal, useCaseModal } from "@/components/cases/case-modal";
import { Skeleton } from "@/components/ui/skeleton";

export default function CasesPage() {
  const router = useRouter();
  const casesQuery = useCases();
  const graph = useGraphStats();
  const modal = useCaseModal();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("all");

  const cases = casesQuery.data?.cases;
  const inGraph = useMemo(() => new Set(graph.data?.case_ids ?? []), [graph.data]);

  const specialties = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cases ?? []) counts.set(c.specialty, (counts.get(c.specialty) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cases ?? []).filter(
      (c) =>
        (specialty === "all" || c.specialty === specialty) &&
        (!q || c.case_id.includes(q) || c.title.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q)),
    );
  }, [cases, query, specialty]);

  const accent = SECTION.cases.accent;

  return (
    <>
      <PageHeader section={SECTION.cases} />

      {casesQuery.isError ? (
        <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} title="Could not load cases" />
      ) : (
        <Panel accent={accent} bodyClassName="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search cases"
                placeholder="Search by case number, title or specialty"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-sky-400/60"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-mono text-sky-300">{filtered.length}</span> of {cases?.length ?? 0}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[["all", cases?.length ?? 0] as const, ...specialties].map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setSpecialty(name)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  specialty === name ? [accent.bgSoft, accent.border, accent.text] : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {name === "all" ? "All specialties" : name} <span className="ml-1 font-mono opacity-70">{count}</span>
              </button>
            ))}
          </div>

          {casesQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No cases match" description="Try a different search term or specialty." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Specialty</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c, i) => (
                    <motion.tr
                      key={c.case_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 14) * 0.02 }}
                      onClick={() => modal.show(c.case_id)}
                      className="cursor-pointer transition-colors hover:bg-sky-500/5"
                    >
                      <td className="px-4 py-3 font-mono text-sky-300">{c.case_id}</td>
                      <td className="px-4 py-3">
                        <span className="line-clamp-1">{cleanCaseTitle(c.title)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">{c.specialty}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.specialty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {inGraph.has(c.case_id) && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[11px] text-violet-300">
                              <Network className="size-3" /> Graph
                            </span>
                          )}
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <CaseModal
        caseId={modal.caseId}
        open={modal.open}
        onClose={modal.close}
        onAnalyze={(id) => { modal.close(); router.push(`/analyze?case=${id}`); }}
      />
    </>
  );
}