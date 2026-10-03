"""
MCP server exposing ChronoMed's tools over the Model Context Protocol,
so any MCP-compatible client (Claude Desktop, etc.) can call them directly.
"""
from fastmcp import FastMCP
from src.tools.lab_calculator import lab_calculator_tool
from src.tools.drug_interaction import drug_interaction_tool
from src.tools.web_search_tool import web_search_tool
from src.retrieval.vector_store import search as vector_search
from src.retrieval.graph_retriever import get_graph_context, search_entities_by_keyword

mcp = FastMCP("ChronoMed")


@mcp.tool()
def check_lab_values(text: str) -> str:
    """Scans clinical text for lab values and flags anything outside normal reference ranges."""
    return lab_calculator_tool(text)


@mcp.tool()
def check_drug_interactions(medications: list[str]) -> str:
    """Checks a list of medication names for known pairwise drug interactions."""
    return drug_interaction_tool(medications)


@mcp.tool()
def search_medical_web(query: str) -> str:
    """Searches the web for general medical reference information (not patient data)."""
    return web_search_tool(query)


@mcp.tool()
def search_patient_cases(query: str, k: int = 5) -> str:
    """Semantic search over the indexed MedChain case corpus."""
    results = vector_search(query, k=k)
    if not results:
        return "No matching cases found."
    return "\n\n".join(
        f"[case {r.metadata.get('case_id')}] {r.page_content[:300]}" for r in results
    )


@mcp.tool()
def get_case_graph_context(case_id: str) -> str:
    """Returns known entities (symptoms/diagnoses/treatments) for a case from the knowledge graph."""
    context = get_graph_context(case_id)
    return context or f"No knowledge-graph data yet for case {case_id}."


@mcp.tool()
def search_graph_entities(keyword: str) -> str:
    """Searches the knowledge graph for entities matching a keyword, across all cases."""
    result = search_entities_by_keyword(keyword)
    return result or f"No graph entities found matching '{keyword}'."


if __name__ == "__main__":
    mcp.run()