"""
Diagnostician agent.
Reads the clinical timeline and produces 3 differential diagnoses as JSON.
"""
import re
import json
from typing import List
from langchain_core.messages import SystemMessage, HumanMessage

from src.agents.state import AgentState, Hypothesis
from src.models.llm_client import get_llm
from src.prompts.diagnostician_prompts import (
    DIAGNOSTICIAN_SYSTEM_PROMPT,
    format_diagnostician_input,
)
from src.utils.llm_helpers import extract_text
from src.utils.logger import get_logger

logger = get_logger(__name__)


def _strip_code_fences(text: str) -> str:
    """Removes markdown code fences if the model added them."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_json_array(text: str) -> str:
    """Returns the first JSON array substring found in the text."""
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON array found in LLM output")
    return text[start:end + 1]


def _parse_hypotheses(raw: str) -> List[Hypothesis]:
    """Converts the LLM output string into a list of Hypothesis dicts."""
    cleaned = _strip_code_fences(raw)
    json_str = _extract_json_array(cleaned)
    data = json.loads(json_str)

    if not isinstance(data, list):
        raise ValueError("Parsed JSON is not a list")

    out: List[Hypothesis] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        out.append({
            "diagnosis": str(item.get("diagnosis", "")).strip(),
            "confidence": float(item.get("confidence", 0.0)),
            "evidence": [str(e) for e in item.get("evidence", [])],
            "reasoning": str(item.get("reasoning", "")).strip(),
            "citations": [str(c) for c in item.get("citations", [])],
        })

    out.sort(key=lambda h: h["confidence"], reverse=True)
    return out


def diagnostician_node(state: AgentState) -> dict:
    """
    LangGraph node for the Diagnostician.
    Reads: objective, clinical_timeline.
    Writes: hypotheses.
    """
    objective = state["objective"]
    timeline = state.get("clinical_timeline", "")

    if not timeline or "cannot be built" in timeline.lower():
        logger.warning("Diagnostician: no valid timeline, skipping")
        return {"hypotheses": []}

    user_msg = format_diagnostician_input(objective, timeline)
    llm = get_llm(temperature=0.0)

    try:
        response = llm.invoke([
            SystemMessage(content=DIAGNOSTICIAN_SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])
        raw = extract_text(response.content).strip()
    except Exception as e:
        logger.error(f"Diagnostician LLM call failed: {e}")
        return {"hypotheses": []}

    try:
        hypotheses = _parse_hypotheses(raw)
    except Exception as e:
        logger.error(f"Diagnostician: JSON parse failed: {e}")
        preview = raw[:300].replace("\n", " ")
        logger.error(f"Raw output preview: {preview}")
        return {"hypotheses": []}

    logger.info(f"Diagnostician: produced {len(hypotheses)} hypotheses")
    for h in hypotheses:
        logger.info(f"  - {h['diagnosis']} (confidence {h['confidence']:.2f})")

    return {"hypotheses": hypotheses}