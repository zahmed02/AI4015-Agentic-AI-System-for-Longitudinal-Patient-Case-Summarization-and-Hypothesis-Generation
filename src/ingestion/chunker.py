"""
Splits English MedChain documents into retrieval-friendly chunks.
Hard cap prevents any single document from exploding.
"""
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.utils.logger import get_logger

logger = get_logger(__name__)


def chunk_documents(
    docs: List[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    max_chunks_per_doc: int = 30,
) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n## ", "\n\n", "\n", ". ", " ", ""],
    )
    all_chunks: List[Document] = []
    for doc in docs:
        pieces = splitter.split_text(doc.page_content)[:max_chunks_per_doc]
        for i, piece in enumerate(pieces):
            meta = dict(doc.metadata)
            meta["chunk_id"] = f"{meta.get('case_id', 'unknown')}_c{i}"
            meta["chunk_index"] = i
            all_chunks.append(Document(page_content=piece, metadata=meta))
    logger.info(f"Produced {len(all_chunks)} chunks from {len(docs)} documents")
    return all_chunks