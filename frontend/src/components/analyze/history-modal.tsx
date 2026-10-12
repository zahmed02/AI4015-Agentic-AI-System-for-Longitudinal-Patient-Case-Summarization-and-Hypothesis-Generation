"use client";

import { History, Trash2 } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { clearHistory, type HistoryEntry } from "@/lib/history";
import { formatDateTime, pct } from "@/lib/format";
import { SECTION } from "@/lib/sections";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onSelect: (jobId: string) => void;
}

export function HistoryModal({ open, onClose, entries, onSelect }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={History}
      accent={SECTION.analyze.accent}
      title="Analysis history"
      subtitle="Saved in this browser"
      footer={
        entries.length > 0 ? (
          <Button variant="outline" className="gap-2" onClick={clearHistory}>
            <Trash2 className="size-4" /> Clear history
          </Button>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <EmptyState icon={History} title="No saved analyses" description="Completed analyses appear here so you can reopen them later." />
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const top = e.result.hypotheses[0];
            return (
              <li key={e.job_id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(e.job_id);
                    onClose();
                  }}
                  className="w-full rounded-xl border border-border bg-background/50 p-4 text-left transition-colors hover:border-emerald-400/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.objective}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(e.finished_at)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border px-1.5 py-0.5">{e.case_id ? `Case ${e.case_id}` : "Global search"}</span>
                    {top && (
                      <span>
                        Top hypothesis: <span className="text-emerald-300">{top.diagnosis}</span> ({pct(top.confidence)})
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}