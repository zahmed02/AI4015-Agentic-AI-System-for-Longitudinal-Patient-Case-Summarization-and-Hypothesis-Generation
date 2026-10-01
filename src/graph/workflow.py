"""
LangGraph workflow for the ChronoMed multi-agent pipeline.
Wires Historian, Diagnostician, and Critic with a conditional revision loop.
"""
from langgraph.graph import StateGraph, START, END

from src.agents.state import AgentState
from src.agents.historian_agent import historian_node
from src.agents.diagnostician_agent import diagnostician_node
from src.agents.critic_agent import critic_node
from src.utils.logger import get_logger

logger = get_logger(__name__)


def route_after_critic(state: AgentState) -> str:
    """
    Conditional edge after the Critic node.
    Decides whether to approve and stop, or loop back for a revision.
    Returns one of: END, "historian", "diagnostician".
    """
    if state.get("critic_approved"):
        return END

    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    if iteration >= max_iterations:
        return END

    target = state.get("revision_target", "none")
    if target == "historian":
        return "historian"
    if target == "diagnostician":
        return "diagnostician"

    return END


def build_graph():
    """Builds and compiles the agentic StateGraph."""
    graph = StateGraph(AgentState)

    graph.add_node("historian", historian_node)
    graph.add_node("diagnostician", diagnostician_node)
    graph.add_node("critic", critic_node)

    graph.add_edge(START, "historian")
    graph.add_edge("historian", "diagnostician")
    graph.add_edge("diagnostician", "critic")
    graph.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "historian": "historian",
            "diagnostician": "diagnostician",
            END: END,
        },
    )

    return graph.compile()


def get_compiled_graph():
    """Returns a compiled graph ready to invoke."""
    return build_graph()