"""
RAGAS evaluation wired to Gemini/Groq (no OpenAI dependency, since RAGAS
defaults to OpenAI as the judge LLM otherwise).
Evaluates faithfulness (are claims grounded in retrieved context?) and
answer relevancy (does the output address the objective?) for a set of
test cases run through the full pipeline.
"""
from typing import List, Dict
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper

from src.models.llm_client import get_primary_llm
from src.retrieval.vector_store import get_embeddings
from src.graph.workflow import get_compiled_graph
from src.utils.logger import get_logger

logger = get_logger(__name__)


def _run_case(app, objective: str, case_id: str = None) -> Dict:
    state = {"objective": objective, "case_id": case_id, "iteration": 0, "max_iterations": 3}
    result = app.invoke(state)
    contexts = [c["content"] for c in result.get("retrieved_chunks", [])]
    answer = "; ".join(
        f"{h['diagnosis']} ({h['confidence']:.2f}): {h['reasoning']}"
        for h in result.get("hypotheses", [])
    )
    return {
        "question": objective,
        "answer": answer or "(no hypotheses produced)",
        "contexts": contexts or ["(no context retrieved)"],
    }


def run_evaluation(test_cases: List[Dict]) -> Dict:
    """
    test_cases: list of {"objective": str, "case_id": Optional[str]}
    Returns the aggregate RAGAS scores.
    """
    app = get_compiled_graph()
    judge_llm = LangchainLLMWrapper(get_primary_llm(temperature=0.0))
    judge_embeddings = LangchainEmbeddingsWrapper(get_embeddings())

    rows = []
    for tc in test_cases:
        logger.info(f"Running case for eval: {tc['objective']}")
        rows.append(_run_case(app, tc["objective"], tc.get("case_id")))

    dataset = Dataset.from_list(rows)
    results = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy],
        llm=judge_llm,
        embeddings=judge_embeddings,
    )
    return results.to_pandas().to_dict(orient="records")


if __name__ == "__main__":
    SAMPLE_CASES = [
        {"objective": "chest pain with fever", "case_id": "48"},
        {"objective": "hepatitis B with jaundice", "case_id": None},
    ]
    scores = run_evaluation(SAMPLE_CASES)
    for row in scores:
        print(row)