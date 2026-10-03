"""
Neo4j-backed graph retrieval. Complements vector search with structured
entity context (symptoms/diagnoses/treatments linked per case).
Fails soft everywhere: if Neo4j is unreachable or a case has no graph data
yet, callers get an empty string rather than an exception — the pipeline
must keep working with vector-only retrieval while the KG is still being built.
"""
import os
from functools import lru_cache
from dotenv import load_dotenv
from neo4j import GraphDatabase
from src.utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


@lru_cache(maxsize=1)
def _get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def get_graph_context(case_id: str) -> str:
    """Returns a flat text summary of entities/relations for one case.
    Confirmed and differential diagnoses are explicitly labeled so the
    LLM never mistakes a ruled-out candidate for an actual finding."""
    if not case_id:
        return ""
    query = """
    MATCH (c:Case {case_id: $case_id})-[r]->(e)
    RETURN type(r) AS relation, labels(e)[0] AS entity_type, e.name AS entity_name
    LIMIT 25
    """
    try:
        driver = _get_driver()
        with driver.session() as session:
            records = session.run(query, case_id=str(case_id)).data()
    except Exception as e:
        logger.warning(f"Graph retrieval failed for case {case_id}: {e}")
        return ""

    if not records:
        return ""

    lines = []
    for r in records:
        if r["relation"] == "HAS_CONFIRMED_DIAGNOSIS":
            lines.append(f"- CONFIRMED diagnosis: {r['entity_name']}")
        elif r["relation"] == "CONSIDERED_DIAGNOSIS":
            lines.append(f"- Considered but not confirmed (differential): {r['entity_name']}")
        else:
            lines.append(f"- {r['entity_type']} ({r['relation']}): {r['entity_name']}")
    return "\n".join(lines)


def search_entities_by_keyword(keyword: str, limit: int = 10) -> str:
    """Simple CONTAINS-based entity search across the whole graph (no embeddings in Neo4j)."""
    query = """
    MATCH (e)
    WHERE toLower(e.name) CONTAINS toLower($keyword)
    OPTIONAL MATCH (c:Case)-[r]->(e)
    RETURN DISTINCT e.name AS entity_name, labels(e)[0] AS entity_type,
           collect(DISTINCT c.case_id)[0..5] AS case_ids
    LIMIT $limit
    """
    try:
        driver = _get_driver()
        with driver.session() as session:
            records = session.run(query, keyword=keyword, limit=limit).data()
    except Exception as e:
        logger.warning(f"Graph keyword search failed for '{keyword}': {e}")
        return ""

    if not records:
        return ""
    lines = [
        f"- {r['entity_type']}: {r['entity_name']} (seen in cases: {r['case_ids']})"
        for r in records
    ]
    return "\n".join(lines)