"""Small, deterministic lexical retriever for symptom descriptions.

The retriever intentionally uses no generative model and makes no diagnostic
claim. It ranks conditions from the project corpus using TF-IDF cosine
similarity and token-set Jaccard similarity.
"""

from __future__ import annotations

import csv
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


TOKEN_PATTERN = re.compile(r"[a-z]+")

# A deliberately small, reviewable normalization map. These terms improve
# retrieval without requiring NLTK downloads at application startup.
SYNONYM_GROUPS = (
    {"breathless", "breathlessness", "dyspnea", "breathing"},
    {"tired", "tiredness", "fatigue", "exhausted"},
    {"faint", "fainting", "dizzy", "dizziness"},
    {"ache", "aching", "pain", "painful"},
    {"vomit", "vomiting", "nausea", "nauseous"},
    {"fever", "temperature", "febrile"},
    {"cough", "coughing"},
    {"swollen", "swelling"},
)

EMERGENCY_PHRASES = (
    "cannot breathe",
    "can't breathe",
    "difficulty breathing",
    "severe chest pain",
    "unconscious",
    "not responding",
    "one side weakness",
    "face drooping",
    "suicidal",
    "kill myself",
)

EMERGENCY_MESSAGE = (
    "Possible emergency symptoms were detected. Seek immediate medical help "
    "or contact your local emergency service. CureNet cannot assess or "
    "diagnose an emergency."
)


@dataclass(frozen=True)
class SearchResult:
    condition: str
    similarity_score: float
    matched_terms: tuple[str, ...]


def tokenize(text: str) -> list[str]:
    """Normalize text into stable lexical tokens."""

    return TOKEN_PATTERN.findall(text.lower())


def expand_tokens(tokens: list[str]) -> list[str]:
    expanded = set(tokens)
    for group in SYNONYM_GROUPS:
        if expanded.intersection(group):
            expanded.update(group)
    return sorted(expanded)


class SymptomRetriever:
    """Rank conditions from a CSV symptom corpus."""

    def __init__(self, dataset_path: Path) -> None:
        self.dataset_path = dataset_path
        self.documents = self._load_documents(dataset_path)
        self.document_count = len(self.documents)
        self.idf = self._build_idf()
        self.document_vectors = [
            self._tfidf_vector(tokens) for _, tokens in self.documents
        ]

    @staticmethod
    def _load_documents(path: Path) -> list[tuple[str, list[str]]]:
        if not path.exists():
            raise RuntimeError(f"Symptom dataset not found: {path}")

        documents: list[tuple[str, list[str]]] = []
        with path.open("r", encoding="ISO-8859-1", newline="") as stream:
            for row in csv.DictReader(stream):
                condition = (row.get("Disease") or "").strip()
                symptoms = (row.get("Symptoms") or "").strip()
                tokens = tokenize(symptoms)
                if condition and tokens:
                    documents.append((condition, tokens))

        if not documents:
            raise RuntimeError(f"Symptom dataset contains no usable rows: {path}")
        return documents

    def _build_idf(self) -> dict[str, float]:
        document_frequency: Counter[str] = Counter()
        for _, tokens in self.documents:
            document_frequency.update(set(tokens))
        return {
            token: math.log((1 + self.document_count) / (1 + frequency)) + 1.0
            for token, frequency in document_frequency.items()
        }

    def _tfidf_vector(self, tokens: list[str]) -> dict[str, float]:
        counts = Counter(tokens)
        total = sum(counts.values()) or 1
        return {
            token: (count / total) * self.idf[token]
            for token, count in counts.items()
            if token in self.idf
        }

    @staticmethod
    def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
        if not left or not right:
            return 0.0
        shared = left.keys() & right.keys()
        numerator = sum(left[token] * right[token] for token in shared)
        left_norm = math.sqrt(sum(value * value for value in left.values()))
        right_norm = math.sqrt(sum(value * value for value in right.values()))
        return numerator / (left_norm * right_norm) if left_norm and right_norm else 0.0

    @staticmethod
    def _jaccard(left: set[str], right: set[str]) -> float:
        union = left | right
        return len(left & right) / len(union) if union else 0.0

    @staticmethod
    def emergency_message(query: str) -> str | None:
        normalized = " ".join(tokenize(query))
        if any(" ".join(tokenize(phrase)) in normalized for phrase in EMERGENCY_PHRASES):
            return EMERGENCY_MESSAGE
        return None

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        query_tokens = expand_tokens(tokenize(normalized_query))
        query_set = set(query_tokens)
        query_vector = self._tfidf_vector(query_tokens)
        ranked: list[SearchResult] = []

        for (condition, document_tokens), document_vector in zip(
            self.documents, self.document_vectors
        ):
            document_set = set(document_tokens)
            cosine = self._cosine(query_vector, document_vector)
            jaccard = self._jaccard(query_set, document_set)
            score = 0.75 * cosine + 0.25 * jaccard
            if score > 0:
                ranked.append(
                    SearchResult(
                        condition=condition,
                        similarity_score=score,
                        matched_terms=tuple(sorted(query_set & document_set)),
                    )
                )

        ranked.sort(key=lambda item: item.similarity_score, reverse=True)
        return ranked[:top_k]
