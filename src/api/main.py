"""
ChronoMed FastAPI application.
Exposes the agentic workflow over HTTP for the frontend layer.
"""
import time
from typing import List
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.graph.workflow import get_compiled_graph
from src.retrieval.vector_store import get_vector_store
from src.utils.guardrails import check_objective, append_disclaimer
from src.api.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    HypothesisResponse,
    RetrievedChunkResponse,
    HealthResponse,
    CasesResponse,
    CaseInfo,
)
from src.utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="ChronoMed API",
    description="Agentic AI for longitudinal clinical reasoning",
    version="1.0.0",
)

# Allow all origins for now. Restrict before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_utf8_json(request: Request, call_next):
    """
    Ensures JSON responses declare charset=utf-8.
    Prevents Windows PowerShell Invoke-RestMethod from
    mis-decoding non-ASCII content using the system codepage.
    """
    response = await call_next(request)
    ctype = response.headers.get("content-type", "")
    if ctype.startswith("application/json") and "charset" not in ctype:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


# Lazily compiled graph. Built on first request to avoid slow startup.
_compiled_graph = None


def _get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = get_compiled_graph()
    return _compiled_graph


def _compute_status(state):
    approved = state.get("critic_approved", False)
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 3)
    if approved and iteration < max_iter:
        return "APPROVED"
    if approved and iteration >= max_iter:
        return "MAX_ITERATIONS_REACHED"
    return "NOT_CONVERGED"


@app.get("/health", response_model=HealthResponse)
def health():
    try:
        count = get_vector_store()._collection.count()
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return HealthResponse(status="ok", chroma_chunks=count)


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(req: AnalysisRequest):
    """
    Runs the full Historian, Diagnostician, Critic workflow.
    Returns the final state as a structured response.
    """
    ok, reason = check_objective(req.objective)
    if not ok:
        logger.warning(f"Analyze request rejected by guardrails: {reason}")
        raise HTTPException(status_code=400, detail=reason)

    logger.info(f"Analyze request: case_id={req.case_id} objective={req.objective[:60]}")

    app_graph = _get_graph()
    initial_state = {
        "objective": req.objective,
        "case_id": req.case_id,
        "iteration": 0,
        "max_iterations": req.max_iterations,
    }

    start = time.time()
    try:
        final_state = app_graph.invoke(initial_state)
    except Exception as e:
        logger.error(f"Graph invocation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Agent workflow failed: {e}")
    elapsed = time.time() - start

    hypotheses = [
        HypothesisResponse(
            diagnosis=h.get("diagnosis", ""),
            confidence=h.get("confidence", 0.0),
            evidence=h.get("evidence", []),
            reasoning=h.get("reasoning", ""),
            citations=h.get("citations", []),
        )
        for h in final_state.get("hypotheses", [])
    ]

    chunks = [
        RetrievedChunkResponse(
            chunk_id=c.get("chunk_id", ""),
            case_id=c.get("case_id", ""),
            title=c.get("title", ""),
            specialty=c.get("specialty", ""),
            score=c.get("score", 0.0),
            preview=c.get("content", "")[:300],
        )
        for c in final_state.get("retrieved_chunks", [])
    ]

    return AnalysisResponse(
        status=_compute_status(final_state),
        iterations_used=final_state.get("iteration", 0),
        critic_approved=final_state.get("critic_approved", False),
        critic_issues=final_state.get("critic_issues", []),
        critic_feedback=final_state.get("critic_feedback", ""),
        clinical_timeline=append_disclaimer(final_state.get("clinical_timeline", "")),
        hypotheses=hypotheses,
        retrieved_chunks=chunks,
        runtime_seconds=round(elapsed, 2),
    )


@app.get("/cases", response_model=CasesResponse)
def list_cases():
    """Lists all cases currently indexed in ChromaDB."""
    try:
        data = get_vector_store()._collection.get(limit=100000, include=["metadatas"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    seen = {}
    for m in data["metadatas"]:
        cid = m.get("case_id", "")
        if cid and cid not in seen:
            seen[cid] = CaseInfo(
                case_id=cid,
                title=m.get("title", ""),
                specialty=m.get("specialty", "unknown"),
            )

    cases = sorted(seen.values(), key=lambda c: int(c.case_id) if c.case_id.isdigit() else 0)
    return CasesResponse(total=len(cases), cases=cases)