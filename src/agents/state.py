"""
Agent state for the ChronoMed multi-agent clinical reasoning pipeline.
Shared blackboard passed between Historian, Diagnostician, and Critic.
"""
from typing import TypedDict, List, Dict, Any, Optional


class RetrievedChunk(TypedDict):
    """A single chunk retrieved from the vector store."""
    chunk_id: str
    case_id: str
    title: str
    specialty: str
    content: str
    score: float


class Hypothesis(TypedDict):
    """A differential diagnosis proposed by the Diagnostician."""
    diagnosis: str
    confidence: float
    evidence: List[str]
    reasoning: str
    citations: List[str]


class AgentState(TypedDict, total=False):
    """
    State passed between nodes in the LangGraph workflow.

    Fields are populated progressively:
      - objective and case_id: set at start
      - retrieved_chunks and clinical_timeline: written by Historian
      - hypotheses: written by Diagnostician
      - critic_approved, critic_feedback, critic_issues: written by Critic
      - iteration, should_revise, revision_target: control flow
      - final_report: written at END
    """

    # Input
    objective: str
    case_id: Optional[str]

    # Historian output
    retrieved_chunks: List[RetrievedChunk]
    clinical_timeline: str

    # Diagnostician output
    hypotheses: List[Hypothesis]

    # Critic output
    critic_approved: bool
    critic_feedback: str
    critic_issues: List[str]

    # Control flow
    iteration: int
    max_iterations: int
    should_revise: bool
    revision_target: Optional[str]

    # Final output
    final_report: str