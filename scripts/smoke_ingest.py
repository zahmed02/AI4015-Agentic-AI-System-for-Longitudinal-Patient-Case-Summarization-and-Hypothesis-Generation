"""
Resumable smoke test.
Each run processes the NEXT 5 unprocessed cases.
Rerun repeatedly to walk through the dataset.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ingestion.loader import load_medchain
from src.ingestion.chunker import chunk_documents
from src.retrieval.vector_store import index_chunks, search

print("=" * 70)
print("  ChronoMed — Resumable Smoke Test (5 cases per run)")
print("=" * 70)

docs = load_medchain(limit=5)   # ← 'limit' now means 'next 5'

if not docs:
    print("\n✅ Nothing left to process. All cases done.")
    sys.exit(0)

print(f"\n✂️  Chunking {len(docs)} documents...")
chunks = chunk_documents(docs)
print(f"   → {len(chunks)} chunks")

print(f"\n📥 Indexing into ChromaDB...")
index_chunks(chunks)
print("   ✅ Done")

print(f"\n🔍 Search test...")
results = search("chest pain and fever", k=2)
for r in results:
    print(f"\n[case={r.metadata['case_id']} chunk={r.metadata['chunk_id']}]")
    print(r.page_content[:250], "...")

print("\n" + "=" * 70)
print("  Rerun this script to process the NEXT 5 cases.")
print("=" * 70)