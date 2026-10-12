export type JobStatus = "running" | "completed" | "failed";
export type AgentName = "historian" | "diagnostician" | "critic";
export type AnalysisStatus = "APPROVED" | "MAX_ITERATIONS_REACHED" | "NOT_CONVERGED";

export interface AnalysisRequest {
  objective: string;
  case_id: string | null;
  max_iterations: number;
}

export interface Hypothesis {
  diagnosis: string;
  confidence: number;
  evidence: string[];
  reasoning: string;
  citations: string[];
}

export interface RetrievedChunk {
  chunk_id: string;
  case_id: string;
  title: string;
  specialty: string;
  score: number;
  preview: string;
}

export interface AnalysisResult {
  status: AnalysisStatus;
  iterations_used: number;
  critic_approved: boolean;
  critic_issues: string[];
  critic_feedback: string;
  clinical_timeline: string;
  hypotheses: Hypothesis[];
  retrieved_chunks: RetrievedChunk[];
  runtime_seconds: number;
}

export interface JobEvent {
  id: number;
  t: number;
  agent: AgentName;
  title: string;
  detail: string;
  data: Record<string, unknown>;
}

export interface JobState {
  job_id: string;
  status: JobStatus;
  current_stage: AgentName | null;
  events: JobEvent[];
  result: AnalysisResult | null;
  error: string | null;
  elapsed_seconds: number;
  objective: string;
  case_id: string | null;
  max_iterations: number;
}

export interface CaseInfo {
  case_id: string;
  title: string;
  specialty: string;
}

export interface CasesResponse {
  total: number;
  cases: CaseInfo[];
}

export interface GraphEntities {
  case_id: string;
  available: boolean;
  symptoms: string[];
  confirmed_diagnoses: string[];
  differential_diagnoses: string[];
  treatments: string[];
}

export interface CaseChunk {
  chunk_id: string;
  chunk_index: number;
  content: string;
}

export interface CaseDetail {
  case_id: string;
  title: string;
  specialty: string;
  chunks: CaseChunk[];
  graph: GraphEntities;
}

export interface GraphStats {
  connected: boolean;
  cases: number;
  symptoms: number;
  diagnoses: number;
  treatments: number;
  relationships: number;
  case_ids: string[];
}

export interface EntityHit {
  entity_name: string;
  entity_type: string;
  case_ids: string[];
}

export interface EntitySearchResponse {
  keyword: string;
  connected: boolean;
  hits: EntityHit[];
}

export interface LabFinding {
  lab: string;
  value: number;
  unit: string;
  status: "LOW" | "HIGH" | "normal";
  reference_range: string;
}

export interface LabResponse {
  findings: LabFinding[];
  abnormal_count: number;
  summary: string;
}

export interface DrugPair {
  drug_a: string;
  drug_b: string;
  interaction_found: boolean;
  severity: string | null;
  description: string | null;
  source: string;
}

export interface DrugResponse {
  pairs: DrugPair[];
  flagged_count: number;
  disclaimer: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface SystemStatus {
  api: string;
  chroma: {
    ok: boolean;
    chunks: number;
    cases: number;
    specialties: number;
    collection: string;
    embedding_model: string;
    error: string | null;
  };
  neo4j: { ok: boolean; cases: number; relationships: number };
  llm: {
    primary_provider: string;
    primary_model: string;
    fallback_provider: string;
    fallback_model: string;
  };
  chunking: { chunk_size: number; chunk_overlap: number };
  guardrails: {
    max_objective_length: number;
    require_disclaimer: boolean;
    injection_patterns: number;
    prescribing_patterns: number;
  };
  mcp_tools: { name: string; description: string }[];
}