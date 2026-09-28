"""
ChromaDB vector store: embeds English chunks with a local sentence-transformer.
"""
import os
from typing import List
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from src.utils.logger import get_logger

logger = get_logger(__name__)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/knowledge_base/chroma")
COLLECTION = "patient_records"


def get_embeddings():
    """Local HuggingFace embeddings — no API key required."""
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_vector_store() -> Chroma:
    """Returns a persistent Chroma client."""
    os.makedirs(CHROMA_DIR, exist_ok=True)
    return Chroma(
        collection_name=COLLECTION,
        embedding_function=get_embeddings(),
        persist_directory=CHROMA_DIR,
    )


def index_chunks(chunks: List[Document]) -> Chroma:
    """Adds chunks to Chroma. Safe to call once; re-running duplicates."""
    store = get_vector_store()
    logger.info(f"Indexing {len(chunks)} chunks into Chroma...")
    store.add_documents(chunks)
    logger.info("Indexing complete.")
    return store


def search(query: str, k: int = 5) -> List[Document]:
    """Semantic search over indexed chunks."""
    store = get_vector_store()
    return store.similarity_search(query, k=k)