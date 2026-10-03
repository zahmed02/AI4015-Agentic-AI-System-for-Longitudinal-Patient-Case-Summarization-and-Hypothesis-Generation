"""
Historian agent.
Retrieves relevant case chunks and builds a structured clinical timeline.
Enriches retrieval with Neo4j knowledge-graph context when available.
Adapts retrieval breadth when the Critic routes back here for insufficient evidence.
"""
from typing import List, Optional, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document

from src.agents.state import AgentState, RetrievedChunk
from src.models.llm_client import get_llm
from src.retrieval.vector_store import get_vector_store
from src.retrieval.graph_retriever import get_graph_context
from src.prompts.historian_prompts import (
    HISTORIAN_SYSTEM_PROMPT,
    format_historian_input,
)
from src.utils.llm_helpers import extract_text
from src.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_K = 8
WIDENED_K = 16  # used when the Critic flags insufficient retrieval


def _retrieve(
    objective: str,
    case_id: Optional[str],
    k: int,
) -> List[Tuple[Document, float]]:
    store = get_vector_store()
    if case_id:
        return store.similarity_search_with_score(
            objective, k=k, filter={"case_id": str(case_id)}
        )
    return store.similarity_search_with_score(objective, k=k)


def _format_chunks_for_llm(results: List[Tuple[Document, float]]) -> str:
    if not results:
        return "(no chunks retrieved)"
    parts = []
    for doc, _score in results:
        meta = doc.metadata
        header = (
            f"[case {meta.get('case_id', '?')} | "
            f"{meta.get('specialty', '?')} | "
            f"{meta.get('chunk_id', '?')}]"
        )
        parts.append(f"{header}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def _to_retrieved_chunks(results: List[Tuple[Document, float]]) -> List[RetrievedChunk]:
    out: List[RetrievedChunk] = []
    for doc, score in results:
        meta = doc.metadata
        out.append({
            "chunk_id": meta.get("chunk_id", ""),
            "case_id": meta.get("case_id", ""),
            "title": meta.get("title", ""),
            "specialty": meta.get("specialty", ""),
            "content": doc.page_content,
            "score": float(score),
        })
    return out


def historian_node(state: AgentState) -> dict:
    """
    LangGraph node for the Historian.
    Reads: objective, case_id, and (on a revision loop) critic_feedback/critic_issues
           when revision_target was "historian".
    Writes: retrieved_chunks, clinical_timeline.
    """
    objective = state["objective"]
    case_id = state.get("case_id")
    being_revised = state.get("revision_target") == "historian"
    prior_feedback = state.get("critic_feedback") if being_revised else None
    prior_issues = state.get("critic_issues") if being_revised else None

    # If the Critic specifically said retrieval was insufficient, actually
    # change what we do: widen k and drop a hard case_id filter if present,
    # since over-narrow filtering is the most common reason retrieval comes up short.
    k = WIDENED_K if being_revised else DEFAULT_K
    effective_case_id = None if being_revised else case_id

    logger.info(
        f"Historian: retrieving chunks (case_id={effective_case_id}, k={k}, "
        f"revision_mode={being_revised})"
    )
    results = _retrieve(objective, effective_case_id, k)
    logger.info(f"Historian: retrieved {len(results)} chunks")

    if not results:
        return {
            "retrieved_chunks": [],
            "clinical_timeline": "No case data was retrieved. Timeline cannot be built.",
        }

    chunks_text = _format_chunks_for_llm(results)

    # Optional knowledge-graph enrichment (no-op if Neo4j/kg_builder hasn't been run yet).
    graph_context = get_graph_context(case_id) if case_id else ""
    if graph_context:
        chunks_text += f"\n\n---\n\nKnown entities (knowledge graph):\n{graph_context}"

    user_msg = format_historian_input(
        objective, chunks_text,
        critic_feedback=prior_feedback,
        critic_issues=prior_issues,
    )

    llm = get_llm(temperature=0.0)
    try:
        response = llm.invoke([
            SystemMessage(content=HISTORIAN_SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])
        timeline = extract_text(response.content).strip()
    except Exception as e:
        logger.error(f"Historian LLM call failed: {e}")
        timeline = "Timeline generation failed due to an LLM error."

    logger.info(f"Historian: timeline length = {len(timeline)} chars")

    return {
        "retrieved_chunks": _to_retrieved_chunks(results),
        "clinical_timeline": timeline,
    }