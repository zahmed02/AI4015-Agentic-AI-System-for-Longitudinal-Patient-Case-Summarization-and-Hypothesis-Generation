"""
Pydantic schemas for the ChronoMed FastAPI layer.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


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