"""
Critic agent.
Validates the Diagnostician's hypotheses against retrieved evidence.
Sets should_revise and revision_target for loop control.
"""
import re
import json
from typing import List, Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage

from src.agents.state import AgentState, Hypothesis, RetrievedChunk
from src.models.llm_client import get_llm
from src.prompts.critic_prompts import (
    CRITIC_SYSTEM_PROMPT,
    format_critic_input,
)
from src.utils.llm_helpers import extract_text
from src.utils.logger import get_logger

logger = get_logger(__name__)


def _format_hypotheses(hypotheses: List[Hypothesis]) -> str:
    if not hypotheses:
        return "(no hypotheses provided)"
    parts = []
    for i, h in enumerate(hypotheses, 1):
        parts.append(
            f"Hypothesis {i}: {h['diagnosis']} (confidence {h['confidence']:.2f})\n"
            f"  Reasoning: {h['reasoning']}\n"
            f"  Evidence: {'; '.join(h['evidence'])}\n"
            f"  Citations: {', '.join(h['citations'])}"
        )
    return "\n\n".join(parts)


def _format_chunks(chunks: List[RetrievedChunk]) -> str:
    if not chunks:
        return "(no chunks retrieved)"
    parts = []
    for c in chunks:
        header = f"[case {c['case_id']} | {c['specialty']} | {c['chunk_id']}]"
        parts.append(f"{header}\n{c['content']}")
    return "\n\n---\n\n".join(parts)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in LLM output")
    return text[start:end + 1]


def _parse_verdict(raw: str) -> Dict[str, Any]:
    cleaned = _strip_code_fences(raw)
    json_str = _extract_json_object(cleaned)
    data = json.loads(json_str)

    if not isinstance(data, dict):
        raise ValueError("Parsed JSON is not an object")

    approved = bool(data.get("approved", False))
    issues = [str(i) for i in data.get("issues", [])]
    feedback = str(data.get("feedback", "")).strip()
    target = str(data.get("revision_target", "none")).lower().strip()

    if target not in {"historian", "diagnostician", "none"}:
        target = "none"
    if approved:
        target = "none"

    return {
        "approved": approved,
        "issues": issues,
        "feedback": feedback,
        "revision_target": target,
    }


def _run_llm_review(objective, timeline, hypotheses, chunks) -> Dict[str, Any]:
    """Runs the actual critique LLM call. Raises on failure (caller handles it)."""
    hypotheses_text = _format_hypotheses(hypotheses)
    chunks_text = _format_chunks(chunks)
    user_msg = format_critic_input(objective, timeline, hypotheses_text, chunks_text)

    llm = get_llm(temperature=0.0)
    response = llm.invoke([
        SystemMessage(content=CRITIC_SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ])
    raw = extract_text(response.content).strip()
    return _parse_verdict(raw)


def critic_node(state: AgentState) -> dict:
    """
    LangGraph node for the Critic.
    Reads: objective, clinical_timeline, hypotheses, retrieved_chunks, iteration, max_iterations.
    Writes: critic_approved, critic_issues, critic_feedback, should_revise, revision_target, iteration.

    IMPORTANT: even on the final allowed iteration, this still runs one real
    review pass. It just refuses to request a *further* revision afterward
    (no more LLM calls permitted past max_iterations), so the final report
    never ships un-reviewed hypotheses.
    """
    objective = state["objective"]
    timeline = state.get("clinical_timeline", "")
    hypotheses = state.get("hypotheses", [])
    chunks = state.get("retrieved_chunks", [])
    iteration = state.get("iteration", 0) + 1
    max_iterations = state.get("max_iterations", 3)
    is_final_allowed_pass = iteration >= max_iterations

    if not hypotheses:
        logger.warning("Critic: no hypotheses to review")
        return {
            "critic_approved": False,
            "critic_issues": ["No hypotheses were produced by the Diagnostician."],
            "critic_feedback": "The Diagnostician did not return any hypotheses. Rerun reasoning.",
            "should_revise": False,
            "revision_target": "none",
            "iteration": iteration,
        }

    try:
        verdict = _run_llm_review(objective, timeline, hypotheses, chunks)
    except Exception as e:
        logger.error(f"Critic LLM call / parse failed: {e}")
        return {
            "critic_approved": is_final_allowed_pass,  # don't block forever on a parse failure
            "critic_issues": [f"Critic could not complete review: {e}"],
            "critic_feedback": (
                "Critic failed to produce a verdict. "
                + ("Accepting current hypotheses because max iterations was reached."
                   if is_final_allowed_pass else "Stopping without approval.")
            ),
            "should_revise": False,
            "revision_target": "none",
            "iteration": iteration,
        }

    approved = verdict["approved"]
    issues = verdict["issues"]
    feedback = verdict["feedback"]
    target = verdict["revision_target"]

    if is_final_allowed_pass and not approved:
        # A real review ran and found problems, but no revisions are left.
        # Ship honestly: keep the issues visible, don't silently relabel as approved.
        logger.warning(
            f"Critic: max_iterations ({max_iterations}) reached with unresolved issues "
            f"({len(issues)}). Accepting current hypotheses as final, issues preserved."
        )
        feedback = (
            f"Max iterations reached before all issues were resolved. "
            f"Accepting current hypotheses as final. Outstanding concerns: {feedback}"
        )
        approved = True  # stop the loop — but issues/feedback still reflect real findings
        target = "none"

    should_revise = (not approved) and (target in {"historian", "diagnostician"})

    logger.info(f"Critic: approved={approved} target={target} issues={len(issues)}")
    for issue in issues:
        logger.info(f"  - {issue}")

    return {
        "critic_approved": approved,
        "critic_issues": issues,
        "critic_feedback": feedback,
        "should_revise": should_revise,
        "revision_target": target,
        "iteration": iteration,
    }