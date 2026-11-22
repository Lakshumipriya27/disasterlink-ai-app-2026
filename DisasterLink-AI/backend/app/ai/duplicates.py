"""Similarity-based duplicate detection.

Combines (1) word-level Jaccard similarity, (2) character-trigram cosine similarity,
(3) geographic proximity, (4) same phone number, (5) same category and (6) time proximity.
Returns explainable scores; nothing is merged automatically - coordinators confirm.
"""
import math
from collections import Counter
from datetime import datetime

from ..services.geo import haversine_km
from .classifier import STOPWORDS, normalise, tokenize


def _trigrams(text: str) -> Counter:
    t = f"  {normalise(text)}  "
    return Counter(t[i:i + 3] for i in range(len(t) - 2))


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def _jaccard(a: str, b: str) -> float:
    sa = {t for t in tokenize(a) if t not in STOPWORDS}
    sb = {t for t in tokenize(b) if t not in STOPWORDS}
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def similarity(a: dict, b: dict) -> tuple[float, list[str]]:
    reasons = []
    text_sim = 0.5 * _jaccard(a["description"], b["description"]) + \
        0.5 * _cosine(_trigrams(a["description"]), _trigrams(b["description"]))
    score = 0.5 * text_sim
    reasons.append(f"Text similarity {text_sim:.0%}")

    d = haversine_km(a.get("lat"), a.get("lng"), b.get("lat"), b.get("lng"))
    if d != float("inf"):
        geo = max(0.0, 1 - d / 2.0)  # within 2 km
        score += 0.2 * geo
        reasons.append(f"Distance {d:.2f} km")
    elif a.get("area") and a.get("area") == b.get("area"):
        score += 0.1
        reasons.append("Same area")

    pa, pb = (a.get("contact_phone") or "")[-8:], (b.get("contact_phone") or "")[-8:]
    if pa and pa == pb:
        score += 0.2
        reasons.append("Same contact phone number")

    if a.get("category") == b.get("category"):
        score += 0.07
        reasons.append("Same category")

    ta, tb = a.get("created_at"), b.get("created_at")
    if isinstance(ta, datetime) and isinstance(tb, datetime):
        hours = abs((ta - tb).total_seconds()) / 3600
        if hours <= 24:
            score += 0.03
            reasons.append(f"Submitted {hours:.1f} h apart")
    return min(1.0, round(score, 3)), reasons


def find_duplicates(target: dict, candidates: list[dict], threshold: float = 0.55, limit: int = 5) -> list[dict]:
    out = []
    for c in candidates:
        if c["id"] == target.get("id"):
            continue
        s, reasons = similarity(target, c)
        if s >= threshold:
            out.append({"id": c["id"], "score": s, "reasons": reasons, "description": c["description"][:160],
                        "status": c.get("status"), "area": c.get("area")})
    out.sort(key=lambda x: -x["score"])
    return out[:limit]
