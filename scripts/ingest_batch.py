"""
Atomic batch ingestion.
Each run: process N new cases -> chunk -> index to Chroma -> exit cleanly.
Re-run to process the next batch. Stops at --max-total total cases.

Usage:
    python scripts/ingest_batch.py                      # 10 cases, no total cap
    python scripts/ingest_batch.py --size 20            # 20 cases
    python scripts/ingest_batch.py --max-total 200      # stop at 200 total
    python scripts/ingest_batch.py --status             # show current state
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ingestion.loader import load_medchain
from src.ingestion.chunker import chunk_documents
from src.retrieval.vector_store import index_chunks, get_vector_store
from src.ingestion.progress_tracker import load_progress
from src.utils.logger import get_logger

logger = get_logger(__name__)


def show_status():
    p = load_progress()
    chroma_count = get_vector_store()._collection.count()
    print("=" * 70)
    print("  ChronoMed — Current Status")
    print("=" * 70)
    print(f"  Cases attempted:  {p['next_index']}")
    print(f"  Cases successful: {p['success_count']}")
    print(f"  Cases failed:     {p['fail_count']}  {p['failed_indices']}")
    print(f"  ChromaDB chunks:  {chroma_count}")
    print("=" * 70)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=10,
                    help="Cases per batch (default: 10)")
    ap.add_argument("--max-total", type=int, default=None,
                    help="Stop when this many cases are successfully done")
    ap.add_argument("--status", action="store_true",
                    help="Just show status and exit")
    ap.add_argument("--retry-failed", action="store_true", default=True,
                    help="Retry previously failed cases first (default: True)")
    args = ap.parse_args()

    if args.status:
        show_status()
        return

    # ─── Check if we've hit the total cap ────────────────
    p = load_progress()
    if args.max_total and p["success_count"] >= args.max_total:
        print(f"✅ Already at {p['success_count']} successful cases "
              f"(cap = {args.max_total}). Nothing to do.")
        show_status()
        return

    # ─── Compute actual batch size ───────────────────────
    batch_size = args.size
    if args.max_total:
        remaining_to_cap = args.max_total - p["success_count"]
        batch_size = min(batch_size, remaining_to_cap)

    print("=" * 70)
    print("  ChronoMed — Batch Ingestion")
    print("=" * 70)
    print(f"  Batch size:       {batch_size}")
    print(f"  Max total:        {args.max_total or 'unlimited'}")
    print(f"  Current progress: {p['success_count']} done, {p['fail_count']} failed")
    print(f"  Next index:       {p['next_index']}")
    print("=" * 70)

    # ─── 1. Translate + load the batch ───────────────────
    print(f"\n🩺 Translating next {batch_size} cases...")
    try:
        docs = load_medchain(
            limit=batch_size,
            retry_failed=args.retry_failed,
        )
    except KeyboardInterrupt:
        print("\n⏸️  Interrupted. Progress saved. Rerun to continue.")
        return

    if not docs:
        print("\n✅ No new cases processed (all done, or API exhausted).")
        show_status()
        return

    print(f"\n✅ Translated {len(docs)} cases")

    # ─── 2. Chunk ────────────────────────────────────────
    print(f"\n✂️  Chunking...")
    chunks = chunk_documents(docs)
    print(f"   → {len(chunks)} chunks")

    # ─── 3. Index to Chroma (APPEND, not replace) ────────
    print(f"\n📥 Indexing to ChromaDB (append mode)...")
    index_chunks(chunks)
    print("   ✅ Indexed")

    # ─── 4. Final report ─────────────────────────────────
    print("\n" + "=" * 70)
    print("  ✅ BATCH COMPLETE")
    print("=" * 70)
    show_status()

    if args.max_total and p["success_count"] >= args.max_total:
        print(f"\n🎉 Reached target of {args.max_total} cases. Done!")
    else:
        print(f"\n👉 Rerun this command to process the next {args.size} cases.")


if __name__ == "__main__":
    main()