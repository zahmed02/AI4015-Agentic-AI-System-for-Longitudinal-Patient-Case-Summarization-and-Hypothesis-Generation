"""
Extra API routes used by the frontend: case detail, knowledge graph,
clinical tools and system status.
"""
import html
import itertools
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, HTTPException

from src.api.schemas import (
    CaseChunk, CaseDetailResponse, DrugPair, DrugRequest, DrugResponse,
    EntityHit, EntitySearchResponse, GraphEntitiesResponse, GraphStatsResponse,
    LabFinding, LabRequest, LabResponse, SearchRequest, SearchResponse, SearchResult,
)
from src.models import llm_client
from src.retrieval import graph_retriever as graph
from src.retrieval.vector_store import EMBEDDING_MODEL, get_vector_store
from src.tools.drug_interaction import check_interaction
from src.tools.lab_calculator import flag_abnormal_labs, lab_calculator_tool
from src.tools.web_search_tool import web_search
from src.utils import guardrails
from src.utils.config import get as cfg_get
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── Cases ────────────────────────────────────────────────
@router.get("/cases/{case_id}", response_model=CaseDetailResponse)
def case_detail(case_id: str):
    try:
        data = get_vector_store()._collection.get(
            where={"case_id": str(case_id)}, include=["documents", "metadatas"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not data.get("ids"):
        raise HTTPException(status_code=404, detail=f"Case {case_id} is not indexed.")

    rows = sorted(
        zip(data["metadatas"], data["documents"]),
        key=lambda r: int(r[0].get("chunk_index", 0)),
    )
    first_meta = rows[0][0]
    chunks = [
        CaseChunk(
            chunk_id=str(m.get("chunk_id", "")),
            chunk_index=int(m.get("chunk_index", 0)),
            content=doc,
        )
        for m, doc in rows
    ]
    return CaseDetailResponse(
        case_id=str(case_id),
        title=first_meta.get("title", ""),
        specialty=first_meta.get("specialty", "unknown"),
        chunks=chunks,
        graph=GraphEntitiesResponse(**graph.get_graph_entities(case_id)),
    )


# ── Knowledge graph ──────────────────────────────────────
@router.get("/graph/stats", response_model=GraphStatsResponse)
def graph_stats():
    return GraphStatsResponse(**graph.get_graph_stats())


@router.get("/graph/case/{case_id}", response_model=GraphEntitiesResponse)
def graph_case(case_id: str):
    return GraphEntitiesResponse(**graph.get_graph_entities(case_id))


@router.get("/graph/search", response_model=EntitySearchResponse)
def graph_search(keyword: str):
    keyword = keyword.strip()
    if len(keyword) < 2:
        raise HTTPException(status_code=400, detail="Keyword must be at least 2 characters.")
    found = graph.search_entities_structured(keyword)
    return EntitySearchResponse(
        keyword=keyword,
        connected=found["connected"],
        hits=[EntityHit(**h) for h in found["hits"]],
    )


# ── Tools ────────────────────────────────────────────────
@router.post("/tools/labs", response_model=LabResponse)
def tool_labs(req: LabRequest):
    findings = flag_abnormal_labs(req.text)
    return LabResponse(
        findings=[LabFinding(**f) for f in findings],
        abnormal_count=sum(1 for f in findings if f["status"] != "normal"),
        summary=lab_calculator_tool(req.text),
    )


@router.post("/tools/drugs", response_model=DrugResponse)
def tool_drugs(req: DrugRequest):
    meds = list(dict.fromkeys(m.strip() for m in req.medications if m.strip()))
    if len(meds) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two different medications.")
    pairs = [DrugPair(**check_interaction(a, b)) for a, b in itertools.combinations(meds, 2)]
    return DrugResponse(
        pairs=pairs,
        flagged_count=sum(1 for p in pairs if p.interaction_found),
        disclaimer="Decision support only: checks a small curated table of well-known high-risk interactions. A pair that is not listed is not proof of safety. Not a substitute for pharmacist review.",
    )


def _clean_url(url: str) -> str:
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    if "duckduckgo.com" in parsed.netloc:
        target = parse_qs(parsed.query).get("uddg")
        if target:
            return target[0]
    return url


@router.post("/tools/search", response_model=SearchResponse)
def tool_search(req: SearchRequest):
    raw = web_search(req.query)
    results = [
        SearchResult(
            title=html.unescape(r["title"]),
            url=_clean_url(r["url"]),
            snippet=html.unescape(r["snippet"]),
        )
        for r in raw
    ]
    return SearchResponse(query=req.query, results=results)


# ── System status ────────────────────────────────────────
# Mirrors the tools registered in src/mcp_server/server.py
MCP_TOOLS = [
    {"name": "check_lab_values", "description": "Flags lab values outside normal reference ranges in clinical text."},
    {"name": "check_drug_interactions", "description": "Checks a medication list for known pairwise interactions."},
    {"name": "search_medical_web", "description": "Searches the web for general medical reference information."},
    {"name": "search_patient_cases", "description": "Semantic search over the indexed MedChain case corpus."},
    {"name": "get_case_graph_context", "description": "Returns knowledge-graph entities for a case."},
    {"name": "search_graph_entities", "description": "Searches the knowledge graph for entities across all cases."},
]


@router.get("/system/status")
def system_status():
    chroma = {
        "ok": False, "chunks": 0, "cases": 0, "specialties": 0,
        "collection": cfg_get("vector_store.collection_name", "patient_records"),
        "embedding_model": EMBEDDING_MODEL, "error": None,
    }
    try:
        metas = get_vector_store()._collection.get(limit=100000, include=["metadatas"])["metadatas"]
        chroma.update({
            "ok": True,
            "chunks": len(metas),
            "cases": len({m.get("case_id") for m in metas if m.get("case_id")}),
            "specialties": len({m.get("specialty") for m in metas if m.get("specialty")}),
        })
    except Exception as e:
        chroma["error"] = str(e)

    g = graph.get_graph_stats()

    return {
        "api": "ok",
        "chroma": chroma,
        "neo4j": {"ok": g["connected"], "cases": g["cases"], "relationships": g["relationships"]},
        "llm": {
            "primary_provider": cfg_get("llm.primary_provider", "gemini"),
            "primary_model": llm_client.PRIMARY_MODEL,
            "fallback_provider": cfg_get("llm.fallback_provider", "groq"),
            "fallback_model": llm_client.FALLBACK_MODEL,
        },
        "chunking": {
            "chunk_size": cfg_get("chunking.chunk_size", 1000),
            "chunk_overlap": cfg_get("chunking.chunk_overlap", 150),
        },
        "guardrails": {
            "max_objective_length": guardrails.MAX_OBJECTIVE_LENGTH,
            "require_disclaimer": bool(cfg_get("guardrails.require_disclaimer", True)),
            "injection_patterns": len(guardrails._INJECTION_PATTERNS),
            "prescribing_patterns": len(guardrails._PRESCRIBING_PATTERNS),
        },
        "mcp_tools": MCP_TOOLS,
    }