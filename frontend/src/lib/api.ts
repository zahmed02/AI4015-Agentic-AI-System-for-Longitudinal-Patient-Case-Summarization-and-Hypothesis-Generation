import type {
  AnalysisRequest, CaseDetail, CasesResponse, DrugResponse, EntitySearchResponse,
  GraphEntities, GraphStats, JobState, LabResponse, SearchResponse, SystemStatus,
} from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        detail = body.detail.map((d: { msg?: string }) => d.msg ?? "Invalid input").join("; ");
      }
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  systemStatus: () => request<SystemStatus>("/system/status"),
  cases: () => request<CasesResponse>("/cases"),
  caseDetail: (id: string) => request<CaseDetail>(`/cases/${encodeURIComponent(id)}`),
  startAnalysis: (body: AnalysisRequest) =>
    post<{ job_id: string; status: string }>("/analyze/start", body),
  getJob: (id: string) => request<JobState>(`/analyze/jobs/${encodeURIComponent(id)}`),
  graphStats: () => request<GraphStats>("/graph/stats"),
  graphCase: (id: string) => request<GraphEntities>(`/graph/case/${encodeURIComponent(id)}`),
  graphSearch: (keyword: string) =>
    request<EntitySearchResponse>(`/graph/search?keyword=${encodeURIComponent(keyword)}`),
  labs: (text: string) => post<LabResponse>("/tools/labs", { text }),
  drugs: (medications: string[]) => post<DrugResponse>("/tools/drugs", { medications }),
  webSearch: (query: string) => post<SearchResponse>("/tools/search", { query }),
};