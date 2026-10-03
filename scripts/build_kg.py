"""
Builds the Neo4j knowledge graph.

By default, backfills every case currently indexed in ChromaDB — that's
the real "what's actually in the system" source of truth — NOT the
ingestion pipeline's resume pointer, which only tracks the next
un-embedded cases and will skip anything already embedded.

Usage:
    python scripts/build_kg.py                     # all cases currently in Chroma
    python scripts/build_kg.py --case-id 48
    python scripts/build_kg.py --case-id 48,77,10   # specific cases
"""
import sys, os, argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ingestion.kg_builder import build_graph_for_case_ids
from src.retrieval.vector_store import get_vector_store


def _all_indexed_case_ids():
    store = get_vector_store()
    metas = store._collection.get(limit=100000, include=["metadatas"])["metadatas"]
    return sorted(
        {m.get("case_id") for m in metas if m.get("case_id")},
        key=lambda x: int(x) if x.isdigit() else 0,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case-id", default=None,
                    help="Comma-separated case IDs. Default: every case currently in Chroma.")
    args = ap.parse_args()

    if args.case_id:
        case_ids = [c.strip() for c in args.case_id.split(",")]
    else:
        case_ids = _all_indexed_case_ids()
        print(f"No --case-id given: backfilling all {len(case_ids)} cases currently in Chroma.")
        print("(This will make one entity-extraction LLM call per case not already in the graph.)")

    count = build_graph_for_case_ids(case_ids)
    print(f"Done. {count} cases written/updated in the knowledge graph.")


if __name__ == "__main__":
    main()