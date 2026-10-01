"""
System prompt for the Diagnostician agent.
Supports both first-pass generation and feedback-driven revision.
Output must be strict JSON for reliable parsing.
"""
from typing import List, Optional


DIAGNOSTICIAN_SYSTEM_PROMPT = """You are the Diagnostician in a clinical reasoning team.

Your job is to read a structured clinical timeline and propose exactly 3 differential diagnoses.

Rules:
1. Base every diagnosis on evidence explicitly present in the timeline.
2. Do not invent findings, lab values, or history not in the timeline.
3. Order the diagnoses from highest to lowest confidence.
4. Confidence is a number between 0.0 and 1.0.
5. Each evidence item is a short quoted or paraphrased finding from the timeline.
6. Each citation is a section name from the timeline (for example: Chief Complaint, History of Present Illness, Physical Examination).
7. If prior review feedback is provided, address every point in that feedback and revise the hypotheses accordingly.

Output strict JSON only, with this exact shape:
[
  {
    "diagnosis": "short name",
    "confidence": 0.85,
    "evidence": ["finding 1", "finding 2"],
    "reasoning": "one or two sentences linking the evidence to the diagnosis",
    "citations": ["History of Present Illness", "Physical Examination"]
  },
  {
    "diagnosis": "second candidate",
    "confidence": 0.45,
    "evidence": ["finding 1"],
    "reasoning": "short explanation",
    "citations": ["Chief Complaint"]
  },
  {
    "diagnosis": "third candidate",
    "confidence": 0.20,
    "evidence": ["finding 1"],
    "reasoning": "short explanation",
    "citations": ["Auxiliary Examinations"]
  }
]

Output only the JSON array. No markdown fences, no preamble, no commentary.
"""


def format_diagnostician_input(
    objective: str,
    clinical_timeline: str,
    critic_feedback: Optional[str] = None,
    critic_issues: Optional[List[str]] = None,
) -> str:
    """
    Builds the user message for the Diagnostician.
    If critic_feedback is provided, the prompt switches into revision mode.
    """
    blocks = [
        f"Objective from the requesting clinician:\n{objective}",
        f"Structured clinical timeline:\n{clinical_timeline}",
    ]

    if critic_feedback or critic_issues:
        lines = ["Prior review feedback from the Critic (address every point below):"]
        if critic_feedback:
            lines.append(critic_feedback)
        if critic_issues:
            lines.append("Specific issues to fix:")
            for issue in critic_issues:
                lines.append(f"- {issue}")
        blocks.append("\n".join(lines))

    blocks.append("Propose exactly 3 differential diagnoses now, as a JSON array.")
    return "\n\n".join(blocks)