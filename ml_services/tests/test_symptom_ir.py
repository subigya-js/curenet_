from pathlib import Path

from symptom_ir.service import SymptomRetriever, expand_tokens


DATASET = Path(__file__).resolve().parents[1] / "symptom_ir" / "data" / "conditions.csv"


def test_retriever_returns_ranked_conditions() -> None:
    retriever = SymptomRetriever(DATASET)

    results = retriever.search("cough chest pain and difficulty breathing", top_k=3)

    assert len(results) == 3
    assert results[0].similarity_score >= results[1].similarity_score
    assert all(result.condition for result in results)
    assert all(0 < result.similarity_score <= 1 for result in results)


def test_synonym_expansion_is_deterministic() -> None:
    expanded = expand_tokens(["breathless", "tired"])

    assert "dyspnea" in expanded
    assert "fatigue" in expanded
    assert expanded == sorted(set(expanded))


def test_emergency_language_returns_safety_message() -> None:
    retriever = SymptomRetriever(DATASET)

    message = retriever.emergency_message("I have severe chest pain")

    assert message is not None
    assert "immediate medical help" in message
