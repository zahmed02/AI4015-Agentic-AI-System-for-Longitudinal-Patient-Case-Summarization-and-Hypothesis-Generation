"""
Quick search verification — confirms ChromaDB is queryable.
Usage:
    python scripts/verify_search.py
    python scripts/verify_search.py --query "chest pain with fever"
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.retrieval.vector_store import search, get_vector_store


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever",
                    help="Search query (default: chest pain with fever)")
    ap.add_argument("--k", type=int, default=5, help="Number of results")
    args = ap.parse_args()

    store = get_vector_store()

    # Show total chunk count AND compute the real distinct-case count
    # (previously hardcoded as "73 cases" regardless of actual corpus size)
    all_meta = store._collection.get(limit=100000, include=["metadatas"])["metadatas"]
    count = len(all_meta)
    total_cases = len({m.get("case_id") for m in all_meta if m.get("case_id")})

    print("=" * 70)
    print(f"  ChromaDB: {count} total chunks")
    print(f"  Query:    {args.query!r}")
    print(f"  Top-K:    {args.k}")
    print("=" * 70)

    results = search(args.query, k=args.k)

    seen_cases = set()
    for i, r in enumerate(results, 1):
        case_id = r.metadata.get("case_id", "?")
        chunk_id = r.metadata.get("chunk_id", "?")
        specialty = r.metadata.get("specialty", "?")
        seen_cases.add(case_id)

        print(f"\n── Result {i} ──────────────────────────────")
        print(f"  Case ID:   {case_id}")
        print(f"  Chunk:     {chunk_id}")
        print(f"  Specialty: {specialty}")
        print(f"  Preview:   {r.page_content[:200].replace(chr(10), ' ')}...")

    print("\n" + "=" * 70)
    print(f"  Distinct cases returned: {sorted(seen_cases)}")
    print(f"  Total in corpus:         {count} chunks across {total_cases} cases")
    print("=" * 70)


if __name__ == "__main__":
    main()