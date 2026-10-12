"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { History, Loader2, Microscope } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useCases, useJob } from "@/lib/hooks";
import { addHistory, setActiveJobId, useActiveJobId, useHistory } from "@/lib/history";
import { SECTION } from "@/lib/sections";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { EmptyState, ErrorState } from "@/components/common/states";
import { AnalysisForm } from "@/components/analyze/analysis-form";
import { PipelineStepper, TraceList } from "@/components/analyze/agent-trace";
import { ResultsView } from "@/components/analyze/results-view";
import { HistoryModal } from "@/components/analyze/history-modal";
import { CaseModal, useCaseModal } from "@/components/cases/case-modal";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import type { AgentName } from "@/lib/types";

function AnalyzeWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const caseParam = params.get("case") ?? "";

  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("history"));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const caseModal = useCaseModal();
  const casesQuery = useCases();
  const history = useHistory();
  const activeJobId = useActiveJobId();
  const jobQuery = useJob(activeJobId);

  const start = useMutation({
    mutationFn: api.startAnalysis,
    onSuccess: (res) => {
      setActiveJobId(res.job_id);
      setSelectedId(null);
      setServerError(null);
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "The request failed."),
  });

  // Forget a job the API no longer knows (e.g. the server restarted).
  useEffect(() => {
    if (jobQuery.error instanceof ApiError && jobQuery.error.status === 404) setActiveJobId(null);
  }, [jobQuery.error]);

  // Save every completed analysis to local history.
  const job = jobQuery.data;
  useEffect(() => {
    if (job?.status === "completed" && job.result) {
      addHistory({
        job_id: job.job_id,
        objective: job.objective,
        case_id: job.case_id,
        max_iterations: job.max_iterations,
        finished_at: new Date().toISOString(),
        result: job.result,
        events: job.events,
      });
    }
  }, [job]);

  const entry = selectedId ? (history.find((h) => h.job_id === selectedId) ?? null) : null;
  const events = entry ? entry.events : (job?.events ?? []);
  const result = entry ? entry.result : job?.status === "completed" ? job.result : null;
  const running = !entry && (start.isPending || job?.status === "running");
  const failed = !entry && job?.status === "failed" ? (job.error ?? "The analysis failed.") : null;
  const shownObjective = entry?.objective ?? job?.objective;
  const shownCase = entry ? entry.case_id : job?.case_id;

  return (
    <>
      <PageHeader
        section={SECTION.analyze}
        actions={
          <Button variant="outline" className="gap-2" onClick={() => setHistoryOpen(true)}>
            <History className="size-4" /> History
            {history.length > 0 && <span className="rounded bg-secondary px-1.5 font-mono text-xs">{history.length}</span>}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <AnalysisForm
            cases={casesQuery.data?.cases ?? []}
            casesLoading={casesQuery.isLoading}
            caseFromUrl={caseParam}
            busy={running}
            error={serverError}
            onSubmit={(values) => start.mutate(values)}
          />
          {casesQuery.isError && (
            <div className="mt-4">
              <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} title="Could not load the case list" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {shownObjective && (running || result || failed) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Objective</span>
              <span className="min-w-0 flex-1 font-medium">{shownObjective}</span>
              {shownCase ? (
                <button type="button" onClick={() => caseModal.show(shownCase)} className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300 hover:bg-sky-500/20">
                  Case {shownCase}
                </button>
              ) : (
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">Global search</span>
              )}
            </div>
          )}

          {running && (
            <Panel title="Pipeline running" icon={Loader2} accent={SECTION.analyze.accent}
              description={job ? `Elapsed ${formatDuration(job.elapsed_seconds)}. Events appear as each agent finishes.` : "Starting the pipeline."}
              bodyClassName="space-y-6">
              <PipelineStepper events={events} currentStage={(job?.current_stage ?? "historian") as AgentName | null} running />
              <TraceList events={events} />
            </Panel>
          )}

          {failed && <ErrorState error={new ApiError(500, failed)} title="The analysis could not finish" />}

          {!running && result && (
            <ResultsView key={entry?.job_id ?? job?.job_id} result={result} events={events} onOpenCase={caseModal.show} />
          )}

          {!running && !result && !failed && (
            <EmptyState
              icon={Microscope}
              title="No analysis to show yet"
              description="Pick a case, describe the question and run the pipeline. The reasoning of each agent appears here as it happens."
            />
          )}
        </div>
      </div>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} entries={history} onSelect={setSelectedId} />
      <CaseModal caseId={caseModal.caseId} open={caseModal.open} onClose={caseModal.close}
        onAnalyze={(id) => { caseModal.close(); router.push(`/analyze?case=${id}`); }} />
    </>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzeWorkspace />
    </Suspense>
  );
}