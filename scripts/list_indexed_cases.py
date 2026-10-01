"""
Lists all cases currently indexed in ChromaDB, grouped by specialty.
Use this to pick diverse test cases for the agents.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from collections import defaultdict
from src.retrieval.vector_store import get_vector_store


def main():
    store = get_vector_store()
    data = store._collection.get(limit=100000, include=["metadatas"])
    metas = data["metadatas"]

    by_case = {}
    for m in metas:
        cid = m.get("case_id", "?")
        if cid not in by_case:
            by_case[cid] = {
                "specialty": m.get("specialty", "unknown"),
                "title": m.get("title", ""),
            }

    by_spec = defaultdict(list)
    for cid, info in by_case.items():
        by_spec[info["specialty"]].append(cid)

    print("=" * 70)
    print(f"  Total chunks:       {len(metas)}")
    print(f"  Unique cases:       {len(by_case)}")
    print(f"  Unique specialties: {len(by_spec)}")
    print("=" * 70)

    for spec in sorted(by_spec.keys()):
        cids = sorted(by_spec[spec], key=lambda x: int(x) if x.isdigit() else 0)
        print(f"\n  {spec} ({len(cids)} cases)")
        print(f"    Case IDs: {cids}")
        sample = cids[0]
        print(f"    Sample:   {by_case[sample]['title'][:100]}")


if __name__ == "__main__":
    main()