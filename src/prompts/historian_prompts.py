"""
System prompt for the Historian agent.
The Historian reads retrieved clinical chunks and builds a structured timeline.
"""
from typing import List, Optional

HISTORIAN_SYSTEM_PROMPT = """You are the Historian in a clinical reasoning team.

Your job is to read the provided case excerpts and produce a clean, structured timeline of the patient's clinical presentation.

Rules:
1. Use only information present in the retrieved excerpts. Do not infer or add anything.
2. If a section is missing from the excerpts, write "Not documented" for that section.
3. Preserve exact values for vitals, labs, dates, medications, and dosages.
4. Output plain text with the following headings in this exact order:
   - Chief Complaint
   - History of Present Illness
   - Past Medical History
   - Physical Examination
   - Auxiliary Examinations
   - Preliminary Diagnosis
   - Treatment Given
5. If prior review feedback says retrieval was insufficient, pay special attention to
   whichever section was flagged and extract everything relevant to it from the
   (now broader) excerpts provided.

Keep each section concise. Do not add commentary, disclaimers, or speculation.
"""


def format_historian_input(
    objective: str,
    chunks_text: str,
    critic_feedback: Optional[str] = None,
    critic_issues: Optional[List[str]] = None,
) -> str:
    """Builds the user message for the Historian."""
    blocks = [
        f"Objective from the requesting clinician:\n{objective}",
        f"Retrieved case excerpts:\n{chunks_text}",
    ]

    if critic_feedback or critic_issues:
        lines = ["The previous timeline was flagged as having insufficient retrieval. "
                 "Retrieval has been widened. Address these points specifically:"]
        if critic_feedback:
            lines.append(critic_feedback)
        if critic_issues:
            for issue in critic_issues:
                lines.append(f"- {issue}")
        blocks.append("\n".join(lines))

    blocks.append("Produce the structured clinical timeline now.")
    return "\n\n".join(blocks)