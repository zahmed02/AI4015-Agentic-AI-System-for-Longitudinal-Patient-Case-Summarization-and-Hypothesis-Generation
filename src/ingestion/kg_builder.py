"""
Builds the Neo4j knowledge graph from indexed MedChain documents.
Extracts (Case)-[:HAS_SYMPTOM|HAS_DIAGNOSIS|RECEIVED_TREATMENT]->(Entity)
triples via a single structured-JSON LLM call per document, then MERGEs
them into Neo4j (idempotent — safe to rerun).
"""
import os
import re
import json
from typing import List, Dict
from dotenv import load_dotenv
from neo4j import GraphDatabase
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage

from src.models.llm_client import get_llm
from src.utils.llm_helpers import extract_text
from src.utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

EXTRACTION_PROMPT = """Extract structured clinical entities from this case text.

The text may contain a "Differential Diagnosis" or "Diagnosis" tags section listing
conditions that were CONSIDERED but not necessarily confirmed, separate from a
"Preliminary Diagnosis", "Final Diagnosis", or "Case Analysis / Diagnosis" section
stating what the patient was ACTUALLY diagnosed with. Keep these separate.

Output strict JSON only, with this exact shape:
{
  "symptoms": ["short symptom name", ...],
  "confirmed_diagnoses": ["diagnoses explicitly stated as the actual/final diagnosis", ...],
  "differential_diagnoses": ["diagnoses only listed as considered/ruled-out candidates", ...],
  "treatments": ["short treatment/medication name", ...]
}

Rules:
- If a condition appears in a "Differential Diagnosis" list AND is also confirmed
  elsewhere (e.g., restated in "Preliminary Diagnosis" or "Case Analysis"), put it
  in confirmed_diagnoses only.
- If you are unsure whether a diagnosis was confirmed, put it in differential_diagnoses.
- Limit to the 5 most clinically significant items per category.
Output only the JSON object. No markdown fences, no preamble.
"""


def _extract_entities(text: str) -> Dict[str, List[str]]:
    llm = get_llm(temperature=0.0)
    response = llm.invoke([
        SystemMessage(content=EXTRACTION_PROMPT),
        HumanMessage(content=text[:4000]),
    ])
    raw = extract_text(response.content).strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    data = json.loads(cleaned[start:end + 1])
    return {
        "symptoms": [str(s) for s in data.get("symptoms", [])],
        "confirmed_diagnoses": [str(d) for d in data.get("confirmed_diagnoses", [])],
        "differential_diagnoses": [str(d) for d in data.get("differential_diagnoses", [])],
        "treatments": [str(t) for t in data.get("treatments", [])],
    }


def _write_to_neo4j(driver, case_id: str, title: str, entities: Dict[str, List[str]]):
    query = """
    MERGE (c:Case {case_id: $case_id})
    SET c.title = $title
    WITH c
    UNWIND $symptoms AS s
      MERGE (sym:Symptom {name: toLower(s)})
      MERGE (c)-[:HAS_SYMPTOM]->(sym)
    WITH c
    UNWIND $confirmed AS d
      MERGE (dx:Diagnosis {name: toLower(d)})
      MERGE (c)-[:HAS_CONFIRMED_DIAGNOSIS]->(dx)
    WITH c
    UNWIND $differential AS d
      MERGE (dx:Diagnosis {name: toLower(d)})
      MERGE (c)-[:CONSIDERED_DIAGNOSIS]->(dx)
    WITH c
    UNWIND $treatments AS t
      MERGE (tx:Treatment {name: toLower(t)})
      MERGE (c)-[:RECEIVED_TREATMENT]->(tx)
    """
    with driver.session() as session:
        session.run(
            query,
            case_id=str(case_id), title=title,
            symptoms=entities["symptoms"],
            confirmed=entities["confirmed_diagnoses"],
            differential=entities["differential_diagnoses"],
            treatments=entities["treatments"],
        )


def build_graph_from_documents(docs: List[Document], skip_existing: bool = True) -> int:
    """
    Builds/updates the knowledge graph from a list of (already-translated,
    English) Documents — the same Document objects produced by loader.py.
    Returns the number of cases successfully written.
    """
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    written = 0
    try:
        for doc in docs:
            case_id = doc.metadata.get("case_id", "unknown")
            title = doc.metadata.get("title", "")

            if skip_existing:
                with driver.session() as session:
                    exists = session.run(
                        "MATCH (c:Case {case_id: $cid}) RETURN c LIMIT 1", cid=str(case_id)
                    ).single()
                if exists:
                    continue

            try:
                entities = _extract_entities(doc.page_content)
                _write_to_neo4j(driver, case_id, title, entities)
                written += 1
                logger.info(f"KG: wrote case {case_id} "
                            f"({len(entities['symptoms'])} symptoms, "
                            f"{len(entities['confirmed_diagnoses'])} confirmed dx, "
                            f"{len(entities['differential_diagnoses'])} differential dx, "
                            f"{len(entities['treatments'])} treatments)")
            except Exception as e:
                logger.error(f"KG: failed to process case {case_id}: {e}")
    finally:
        driver.close()

    logger.info(f"KG build complete: {written} cases written")
    return written


def build_graph_for_case_ids(case_ids, raw_dir: str = "./data/raw/MedChain", skip_existing: bool = True) -> int:
    """
    Builds/updates the KG for specific case IDs, independent of the main
    ingestion pipeline's resume pointer (which only tracks "next unembedded
    cases" and will never revisit cases already in Chroma).
    Reuses the translation cache, so already-translated cases cost zero
    extra translation API calls — only the entity-extraction call is new.
    """
    import json
    from src.ingestion.loader import _record_to_document, MERGED_CASES_FILE

    path = os.path.join(raw_dir, MERGED_CASES_FILE)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = list(data.items())

    wanted = {str(c) for c in case_ids}
    docs = []
    for idx, (title, rec) in enumerate(items):
        cid = title.split("_", 1)[0] if "_" in title else f"case_{idx}"
        if cid in wanted:
            try:
                docs.append(_record_to_document(title, rec, idx))
            except Exception as e:
                logger.error(f"KG: could not build document for case {cid}: {e}")

    found_ids = {d.metadata["case_id"] for d in docs}
    missing = wanted - found_ids
    if missing:
        logger.warning(f"KG: requested case IDs not found in {MERGED_CASES_FILE}: {sorted(missing)}")

    return build_graph_from_documents(docs, skip_existing=skip_existing)