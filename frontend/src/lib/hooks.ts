import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export const useSystemStatus = () =>
  useQuery({
    queryKey: ["system-status"],
    queryFn: api.systemStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

export const useCases = () =>
  useQuery({ queryKey: ["cases"], queryFn: api.cases, staleTime: 60_000 });

export const useCaseDetail = (caseId: string | null) =>
  useQuery({
    queryKey: ["case", caseId],
    queryFn: () => api.caseDetail(caseId as string),
    enabled: !!caseId,
  });

export const useGraphStats = () =>
  useQuery({ queryKey: ["graph-stats"], queryFn: api.graphStats, staleTime: 20_000 });

export const useGraphCase = (caseId: string | null) =>
  useQuery({
    queryKey: ["graph-case", caseId],
    queryFn: () => api.graphCase(caseId as string),
    enabled: !!caseId,
  });

export const useEntitySearch = (keyword: string) =>
  useQuery({
    queryKey: ["graph-search", keyword],
    queryFn: () => api.graphSearch(keyword),
    enabled: keyword.trim().length >= 2,
  });

export const useJob = (jobId: string | null) =>
  useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });