"use client";

import { useState } from "react";
import { FolderOpen, Network, Stethoscope } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { ErrorState } from "@/components/common/states";
import { EntityLists } from "@/components/graph/entity-lists";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCaseDetail } from "@/lib/hooks";
import { cleanCaseTitle } from "@/lib/format";
import { SECTION } from "@/lib/sections";

/** Keeps the case id while the exit animation plays. */
export function useCaseModal() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return {
    caseId,
    open,
    show: (id: string) => {
      setCaseId(id);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}

interface Props {
  caseId: string | null;
  open: boolean;
  onClose: () => void;
  onAnalyze?: (caseId: string) => void;
}

export function CaseModal({ caseId, open, onClose, onAnalyze }: Props) {
  const query = useCaseDetail(caseId);
  const detail = query.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={FolderOpen}
      accent={SECTION.cases.accent}
      title={caseId ? `Case ${caseId}` : "Case"}
      subtitle={detail ? `${detail.specialty} · ${cleanCaseTitle(detail.title)}` : undefined}
      widthClass="max-w-4xl"
      footer={
        caseId && onAnalyze ? (
          <Button onClick={() => onAnalyze(caseId)} className="gap-2">
            <Stethoscope className="size-4" /> Analyze this case
          </Button>
        ) : undefined
      }
    >
      {query.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load this case" />}
      {detail && (
        <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Network className="size-4 text-violet-300" />
              <h3 className="text-sm font-semibold">Knowledge graph entities</h3>
            </div>
            {detail.graph.available ? (
              <EntityLists graph={detail.graph} />
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                This case is not in the knowledge graph yet. Add it with{" "}
                <code className="font-mono text-violet-300">python scripts\build_kg.py --case-id {detail.case_id}</code>.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">
              Indexed text <span className="font-mono text-xs text-muted-foreground">({detail.chunks.length} chunks)</span>
            </h3>
            <div className="space-y-3">
              {detail.chunks.map((chunk) => (
                <div key={chunk.chunk_id} className="rounded-xl border border-border bg-background/50">
                  <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-sky-300">{chunk.chunk_id}</div>
                  <pre className="whitespace-pre-wrap px-3 py-3 font-sans text-[13px] leading-relaxed text-foreground/90">
                    {chunk.content}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}