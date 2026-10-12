"""
Neo4j-backed graph retrieval. Complements vector search with structured
entity context (symptoms / confirmed + differential diagnoses / treatments per case).
Fails soft everywhere: if Neo4j is unreachable or a case has no graph data
yet, callers get an empty result rather than an exception.
"""
import os
from functools import lru_cache
from typing import Any, Dict
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


def _sort_ids(ids):
    return sorted((i for i in ids if i), key=lambda x: int(x) if str(x).isdigit() else 0)


def get_graph_context(case_id: str) -> str:
    """Flat text summary for LLM prompts. Confirmed and differential diagnoses are
    explicitly labeled so the LLM never mistakes a ruled-out candidate for a finding."""
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


def get_graph_entities(case_id: str) -> Dict[str, Any]:
    """Structured entities for one case (used by the API / frontend)."""
    result: Dict[str, Any] = {
        "case_id": str(case_id),
        "available": False,
        "symptoms": [],
        "confirmed_diagnoses": [],
        "differential_diagnoses": [],
        "treatments": [],
    }
    query = """
    MATCH (c:Case {case_id: $case_id})
    OPTIONAL MATCH (c)-[r]->(e)
    RETURN c.case_id AS cid, type(r) AS relation, e.name AS name
    """
    try:
        driver = _get_driver()
        with driver.session() as session:
            rows = session.run(query, case_id=str(case_id)).data()
    except Exception as e:
        logger.warning(f"Graph entity lookup failed for case {case_id}: {e}")
        return result

    if not rows:
        return result

    result["available"] = True
    bucket = {
        "HAS_SYMPTOM": "symptoms",
        "HAS_CONFIRMED_DIAGNOSIS": "confirmed_diagnoses",
        "CONSIDERED_DIAGNOSIS": "differential_diagnoses",
        "RECEIVED_TREATMENT": "treatments",
    }
    for row in rows:
        key = bucket.get(row["relation"])
        if key and row["name"]:
            result[key].append(row["name"])
    return result


def get_graph_stats() -> Dict[str, Any]:
    """Node/relationship counts and the list of cases present in the graph."""
    stats: Dict[str, Any] = {
        "connected": False, "cases": 0, "symptoms": 0, "diagnoses": 0,
        "treatments": 0, "relationships": 0, "case_ids": [],
    }
    try:
        driver = _get_driver()
        with driver.session() as session:
            labels = {
                r["label"]: r["n"]
                for r in session.run("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS n").data()
            }
            rels = session.run("MATCH ()-[r]->() RETURN count(r) AS n").single()["n"]
            case_ids = [r["id"] for r in session.run("MATCH (c:Case) RETURN c.case_id AS id").data()]
    except Exception as e:
        logger.warning(f"Graph stats failed: {e}")
        return stats

    stats.update({
        "connected": True,
        "cases": labels.get("Case", 0),
        "symptoms": labels.get("Symptom", 0),
        "diagnoses": labels.get("Diagnosis", 0),
        "treatments": labels.get("Treatment", 0),
        "relationships": rels,
        "case_ids": _sort_ids(case_ids),
    })
    return stats


def search_entities_structured(keyword: str, limit: int = 15) -> Dict[str, Any]:
    """Entity search across the graph, returning which cases each entity appears in."""
    query = """
    MATCH (e)
    WHERE NOT e:Case AND toLower(e.name) CONTAINS toLower($keyword)
    OPTIONAL MATCH (c:Case)-[]->(e)
    RETURN e.name AS entity_name, labels(e)[0] AS entity_type, collect(DISTINCT c.case_id) AS case_ids
    ORDER BY size(case_ids) DESC
    LIMIT $limit
    """
    try:
        driver = _get_driver()
        with driver.session() as session:
            rows = session.run(query, keyword=keyword, limit=limit).data()
    except Exception as e:
        logger.warning(f"Graph keyword search failed for '{keyword}': {e}")
        return {"connected": False, "hits": []}

    hits = [
        {"entity_name": r["entity_name"], "entity_type": r["entity_type"], "case_ids": _sort_ids(r["case_ids"])}
        for r in rows
    ]
    return {"connected": True, "hits": hits}


def search_entities_by_keyword(keyword: str, limit: int = 10) -> str:
    """Text version used by the MCP server."""
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
    return "\n".join(
        f"- {r['entity_type']}: {r['entity_name']} (seen in cases: {r['case_ids']})" for r in records
    )