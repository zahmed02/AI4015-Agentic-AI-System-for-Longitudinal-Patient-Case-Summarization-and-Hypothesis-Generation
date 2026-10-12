"""
Pydantic schemas for the ChronoMed FastAPI layer.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Analysis ─────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    objective: str = Field(..., description="Clinical objective or query")
    case_id: Optional[str] = Field(None, description="Optional case ID to restrict retrieval")
    max_iterations: int = Field(3, ge=1, le=6, description="Maximum revision iterations")


class HypothesisResponse(BaseModel):
    diagnosis: str
    confidence: float
    evidence: List[str]
    reasoning: str
    citations: List[str]


class RetrievedChunkResponse(BaseModel):
    chunk_id: str
    case_id: str
    title: str
    specialty: str
    score: float
    preview: str


class AnalysisResponse(BaseModel):
    status: str
    iterations_used: int
    critic_approved: bool
    critic_issues: List[str]
    critic_feedback: str
    clinical_timeline: str
    hypotheses: List[HypothesisResponse]
    retrieved_chunks: List[RetrievedChunkResponse]
    runtime_seconds: float


class JobStartResponse(BaseModel):
    job_id: str
    status: str


class JobEvent(BaseModel):
    id: int
    t: float
    agent: str
    title: str
    detail: str
    data: Dict[str, Any] = {}


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    current_stage: Optional[str] = None
    events: List[JobEvent]
    result: Optional[AnalysisResponse] = None
    error: Optional[str] = None
    elapsed_seconds: float
    objective: str
    case_id: Optional[str] = None
    max_iterations: int


# ── Health / cases ───────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    chroma_chunks: int


class CaseInfo(BaseModel):
    case_id: str
    title: str
    specialty: str


class CasesResponse(BaseModel):
    total: int
    cases: List[CaseInfo]


class CaseChunk(BaseModel):
    chunk_id: str
    chunk_index: int
    content: str


class GraphEntitiesResponse(BaseModel):
    case_id: str
    available: bool
    symptoms: List[str] = []
    confirmed_diagnoses: List[str] = []
    differential_diagnoses: List[str] = []
    treatments: List[str] = []


class CaseDetailResponse(BaseModel):
    case_id: str
    title: str
    specialty: str
    chunks: List[CaseChunk]
    graph: GraphEntitiesResponse


# ── Knowledge graph ──────────────────────────────────────
class GraphStatsResponse(BaseModel):
    connected: bool
    cases: int
    symptoms: int
    diagnoses: int
    treatments: int
    relationships: int
    case_ids: List[str]


class EntityHit(BaseModel):
    entity_name: str
    entity_type: str
    case_ids: List[str]


class EntitySearchResponse(BaseModel):
    keyword: str
    connected: bool
    hits: List[EntityHit]


# ── Tools ────────────────────────────────────────────────
class LabRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class LabFinding(BaseModel):
    lab: str
    value: float
    unit: str
    status: str
    reference_range: str


class LabResponse(BaseModel):
    findings: List[LabFinding]
    abnormal_count: int
    summary: str


class DrugRequest(BaseModel):
    medications: List[str] = Field(..., min_length=2, max_length=12)


class DrugPair(BaseModel):
    drug_a: str
    drug_b: str
    interaction_found: bool
    severity: Optional[str] = None
    description: Optional[str] = None
    source: str


class DrugResponse(BaseModel):
    pairs: List[DrugPair]
    flagged_count: int
    disclaimer: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]