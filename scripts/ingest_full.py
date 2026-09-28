"""
Full ingestion: runs until done OR API limit hit, resumable.
Usage:
    python scripts/ingest_full.py            # all remaining cases
    python scripts/ingest_full.py --limit 100
    python scripts/ingest_full.py --reset    # start over
"""
import sys, os, argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ingestion.loader import load_medchain
from src.ingestion.chunker import chunk_documents
from src.retrieval.vector_store import index_chunks
from src.ingestion.progress_tracker import load_progress

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Max NEW cases to process (default: unlimited)")
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--no-retry-failed", action="store_true")
    args = ap.parse_args()

    print("=" * 70)
    print("  ChronoMed — Full Ingestion (resumable)")
    print("=" * 70)
    p = load_progress()
    print(f"  Current state: next={p['next_index']} ✅={p['success_count']} ⚠️={p['fail_count']}")
    print("=" * 70)

    try:
        docs = load_medchain(
            limit=args.limit,
            reset=args.reset,
            retry_failed=not args.no_retry_failed,
        )
    except KeyboardInterrupt:
        print("\n⏸️  Interrupted by user. Progress saved.")
        sys.exit(0)

    if docs:
        print(f"\n✂️  Chunking {len(docs)} docs...")
        chunks = chunk_documents(docs)
        print(f"   → {len(chunks)} chunks")
        print(f"\n📥 Indexing...")
        index_chunks(chunks)
        print("   ✅ Done")

    # Final summary
    p = load_progress()
    print(f"\n📊 FINAL: ✅ {p['success_count']} | ⚠️ {p['fail_count']} | next={p['next_index']}")


if __name__ == "__main__":
    main()