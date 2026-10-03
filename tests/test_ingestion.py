"""
Unit tests for ingestion helpers that don't require API calls or a live Chroma/Neo4j.
"""
from src.ingestion.loader import _flatten_to_text, _extract_specialty, _translate_specialty
from src.ingestion.chunker import chunk_documents
from langchain_core.documents import Document


def test_flatten_to_text_handles_nested_dict():
    record = {"tags": {"科室": "内科"}, "summary": "fatigue"}
    text = _flatten_to_text(record)
    assert "## tags" in text
    assert "科室: 内科" in text
    assert "summary: fatigue" in text


def test_translate_specialty_known_value():
    assert _translate_specialty("内科") == "Internal Medicine"


def test_translate_specialty_unknown_falls_back_to_raw():
    assert _translate_specialty("未知科室") == "未知科室"


def test_extract_specialty_from_list_tag():
    record = {"tags": {"科室": ["心血管内科", "内科"]}}
    assert _extract_specialty(record) == "Cardiology"


def test_extract_specialty_missing_tag_returns_unknown():
    assert _extract_specialty({}) == "unknown"


def test_chunk_documents_respects_max_chunks_per_doc():
    long_text = "Sentence. " * 2000
    doc = Document(page_content=long_text, metadata={"case_id": "1"})
    chunks = chunk_documents([doc], max_chunks_per_doc=5)
    assert len(chunks) <= 5


def test_chunk_documents_sets_chunk_id_metadata():
    doc = Document(page_content="short text", metadata={"case_id": "7"})
    chunks = chunk_documents([doc])
    assert chunks[0].metadata["chunk_id"] == "7_c0"