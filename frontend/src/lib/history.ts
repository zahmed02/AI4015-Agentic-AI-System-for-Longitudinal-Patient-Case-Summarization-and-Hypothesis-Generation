import { useMemo, useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/local-store";
import type { AnalysisResult, JobEvent } from "@/lib/types";

export interface HistoryEntry {
  job_id: string;
  objective: string;
  case_id: string | null;
  max_iterations: number;
  finished_at: string;
  result: AnalysisResult;
  events: JobEvent[];
}

const MAX_ENTRIES = 15;
const historyStore = createLocalStore("chronomed.history", "[]");
const activeJobStore = createLocalStore("chronomed.activeJob", "");

function parse(raw: string): HistoryEntry[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useHistory(): HistoryEntry[] {
  const raw = useSyncExternalStore(
    historyStore.subscribe,
    historyStore.getSnapshot,
    historyStore.getServerSnapshot,
  );
  return useMemo(() => parse(raw), [raw]);
}

export function addHistory(entry: HistoryEntry) {
  const current = parse(historyStore.getSnapshot());
  if (current.some((e) => e.job_id === entry.job_id)) return;
  historyStore.set(JSON.stringify([entry, ...current].slice(0, MAX_ENTRIES)));
}

export function clearHistory() {
  historyStore.set(null);
}

export function useActiveJobId(): string | null {
  const raw = useSyncExternalStore(
    activeJobStore.subscribe,
    activeJobStore.getSnapshot,
    activeJobStore.getServerSnapshot,
  );
  return raw || null;
}

export function setActiveJobId(id: string | null) {
  activeJobStore.set(id);
}