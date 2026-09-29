"""
Rebuild ChromaDB from cached translations.
Wipes existing Chroma, re-translates from cache (instant), chunks, and indexes.

Usage:
    python scripts/flush_cached.py          # rebuild from cache
    python scripts/flush_cached.py --dry    # preview only, no changes
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
import shutil
from src.ingestion.loader import _record_to_document
from src.ingestion.chunker import chunk_documents
from src.retrieval.vector_store import index_chunks, get_vector_store
from src.ingestion.progress_tracker import load_progress
from src.utils.logger import get_logger

logger = get_logger(__name__)

RAW_FILE = "./data/raw/MedChain/merged_cases.json"
CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/knowledge_base/chroma")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="Preview only, don't write")
    ap.add_argument("--include-failed", action="store_true",
                    help="Also try to translate the failed cases (uses API)")
    args = ap.parse_args()

    progress = load_progress()
    max_idx = progress["next_index"]  # attempt cases 0..max_idx-1
    failed = set(progress["failed_indices"])

    print("=" * 70)
    print("  ChronoMed — Flush Cache to ChromaDB")
    print("=" * 70)
    print(f"  Cases attempted:    {max_idx}")
    print(f"  Successful (target): {progress['success_count']}")
    print(f"  Failed indices:     {sorted(failed)}")
    print(f"  Include failed:     {args.include_failed}")
    print(f"  Dry run:            {args.dry}")
    print("=" * 70)

    # 1) Load raw cases
    print(f"\n📂 Reading {RAW_FILE}...")
    with open(RAW_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = list(data.items())
    print(f"   Loaded {len(items)} raw cases")

    # 2) Rebuild documents from cache (skip failed unless asked)
    docs = []
    skipped_failed = 0
    for i in range(max_idx):
        if i in failed and not args.include_failed:
            skipped_failed += 1
            continue
        title, rec = items[i]
        try:
            doc = _record_to_document(title, rec, i)  # hits cache, no API call
            docs.append(doc)
        except Exception as e:
            logger.warning(f"idx={i} could not be rebuilt: {e}")
            skipped_failed += 1

    print(f"\n✅ Rebuilt {len(docs)} documents from cache")
    print(f"   Skipped (failed): {skipped_failed}")

    if not docs:
        print("Nothing to index. Exiting.")
        return

    # 3) Chunk
    print(f"\n✂️  Chunking...")
    chunks = chunk_documents(docs)
    print(f"   → {len(chunks)} chunks")

    if args.dry:
        print(f"\n🧪 DRY RUN — would index {len(chunks)} chunks. Exiting.")
        return

    # 4) Wipe Chroma and rebuild
    if os.path.exists(CHROMA_DIR):
        print(f"\n🗑️  Wiping existing Chroma at {CHROMA_DIR}...")
        shutil.rmtree(CHROMA_DIR)
    os.makedirs(CHROMA_DIR, exist_ok=True)

    print(f"\n📥 Indexing fresh into ChromaDB...")
    index_chunks(chunks)

    # 5) Verify
    count = get_vector_store()._collection.count()
    print(f"\n" + "=" * 70)
    print(f"  ✅ DONE")
    print("=" * 70)
    print(f"  Documents: {len(docs)}")
    print(f"  Chunks:    {len(chunks)}")
    print(f"  ChromaDB:  {count} chunks indexed")
    print("=" * 70)


if __name__ == "__main__":
    main()