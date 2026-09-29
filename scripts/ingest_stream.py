"""
Streaming ingestion: process cases one at a time, flush to Chroma every N.
Memory-safe for large runs and durable against interruptions.

Usage:
    python scripts/ingest_stream.py --limit 200 --flush-every 10
    python scripts/ingest_stream.py --limit 1000 --flush-every 20
"""
import sys
import os
import argparse
import time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ingestion.loader import load_medchain
from src.ingestion.chunker import chunk_documents
from src.retrieval.vector_store import index_chunks
from src.ingestion.progress_tracker import load_progress
from src.utils.logger import get_logger

logger = get_logger(__name__)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Max NEW cases to process (default: unlimited)")
    ap.add_argument("--flush-every", type=int, default=10,
                    help="Chunk + index every N cases (default: 10)")
    ap.add_argument("--reset", action="store_true",
                    help="Reset progress before starting")
    args = ap.parse_args()

    print("=" * 70)
    print("  ChronoMed — Streaming Ingestion")
    print("=" * 70)
    print(f"  Limit:         {args.limit or 'unlimited'}")
    print(f"  Flush every:   {args.flush_every} cases")
    print(f"  Reset:         {args.reset}")
    p = load_progress()
    print(f"  Resume from:   idx {p['next_index']}  (✅ {p['success_count']} done)")
    print("=" * 70)

    buffer = []  # holds docs pending chunk+index
    total_indexed_chunks = 0
    session_start = time.time()

    def flush_buffer():
        """Chunk and index the buffer, then clear it."""
        nonlocal buffer, total_indexed_chunks
        if not buffer:
            return
        n = len(buffer)
        print(f"\n📥 Flushing {n} documents to Chroma...")
        chunks = chunk_documents(buffer)
        index_chunks(chunks)
        total_indexed_chunks += len(chunks)
        print(f"   ✅ Indexed {len(chunks)} chunks (session total: {total_indexed_chunks})")
        buffer = []

    # Process in windows so we can stream
    # We call load_medchain repeatedly in small batches.
    # 'limit' semantics in load_medchain is relative, so this works cleanly.
    remaining = args.limit
    first_run = True

    try:
        while True:
            batch_size = args.flush_every
            if remaining is not None:
                batch_size = min(batch_size, remaining)
                if batch_size <= 0:
                    break

            docs = load_medchain(
                limit=batch_size,
                reset=args.reset and first_run,
                retry_failed=True,
            )
            first_run = False

            if not docs:
                print("\n✅ No more cases to process. Done.")
                break

            buffer.extend(docs)

            # If the loader returned fewer than we asked, we've hit the end
            # OR hit the consecutive-failure stop. Flush what we have.
            if len(docs) < batch_size:
                flush_buffer()
                print(f"\n⚠️  Loader stopped early (likely API limit). Session ended.")
                break

            flush_buffer()

            if remaining is not None:
                remaining -= len(docs)

    except KeyboardInterrupt:
        print("\n⏸️  Interrupted. Flushing buffer before exit...")
        flush_buffer()
        print("   Progress + ChromaDB both saved.")

    session_time = time.time() - session_start
    p = load_progress()
    print(f"\n" + "=" * 70)
    print(f"  📊 Session Summary")
    print(f"=" * 70)
    print(f"  Duration:        {session_time / 60:.1f} min")
    print(f"  Cases done:      {p['success_count']}")
    print(f"  Cases failed:    {p['fail_count']}")
    print(f"  Next resume:     idx {p['next_index']}")
    print(f"  ChromaDB chunks: {total_indexed_chunks} added this session")
    print("=" * 70)


if __name__ == "__main__":
    main()