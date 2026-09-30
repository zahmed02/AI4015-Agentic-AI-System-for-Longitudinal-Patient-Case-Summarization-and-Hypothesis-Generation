"""
Historian agent.
Retrieves relevant case chunks and builds a structured clinical timeline.
"""
from typing import List, Optional, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document

from src.agents.state import AgentState, RetrievedChunk
from src.models.llm_client import get_llm
from src.retrieval.vector_store import get_vector_store
from src.prompts.historian_prompts import (
    HISTORIAN_SYSTEM_PROMPT,
    format_historian_input,
)
from src.utils.llm_helpers import extract_text
from src.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_K = 8


def _retrieve(
    objective: str,
    case_id: Optional[str],
    k: int = DEFAULT_K,
) -> List[Tuple[Document, float]]:
    """Retrieves top-k chunks, optionally filtered by case_id."""
    store = get_vector_store()
    if case_id:
        return store.similarity_search_with_score(
            objective, k=k, filter={"case_id": str(case_id)}
        )
    return store.similarity_search_with_score(objective, k=k)


def _format_chunks_for_llm(results: List[Tuple[Document, float]]) -> str:
    """Builds a readable text block of retrieved chunks for the prompt."""
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


def _to_retrieved_chunks(
    results: List[Tuple[Document, float]],
) -> List[RetrievedChunk]:
    """Converts LangChain Documents into RetrievedChunk dicts for state."""
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
    Reads: objective, case_id.
    Writes: retrieved_chunks, clinical_timeline.
    """
    objective = state["objective"]
    case_id = state.get("case_id")

    logger.info(f"Historian: retrieving chunks (case_id={case_id})")
    results = _retrieve(objective, case_id)
    logger.info(f"Historian: retrieved {len(results)} chunks")

    if not results:
        return {
            "retrieved_chunks": [],
            "clinical_timeline": "No case data was retrieved. Timeline cannot be built.",
        }

    chunks_text = _format_chunks_for_llm(results)
    user_msg = format_historian_input(objective, chunks_text)

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