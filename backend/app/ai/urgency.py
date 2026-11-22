"""Transparent, points-based urgency recommendation.

NOT medically validated triage. It is an advisory prioritisation aid: every point added or
removed is listed as a factor so a coordinator can see and override the reasoning.
"""
import math
import re
from datetime import datetime, timezone

from .classifier import normalise

DANGER_TERMS = {
    "drowning": 40, "swept away": 40, "not breathing": 40, "unconscious": 35, "electric shock": 35,
    "electrocuted": 35, "trapped": 30, "neck deep": 30, "chest deep": 25, "rising water": 22, "water rising": 22,
    "collapsed": 25, "heavy bleeding": 30, "bleeding": 18, "chest pain": 30, "heart attack": 35, "stroke": 30,
    "seizure": 28, "cannot breathe": 35, "can't breathe": 35, "rooftop": 20, "roof top": 20, "stuck": 12,
    "marooned": 15, "fire": 25, "snake bite": 28, "labour pain": 28, "labor pain": 28, "dialysis": 20,
    "oxygen": 22, "breathing difficulty": 30, "difficulty breathing": 30, "water entering": 12, "cut off": 10, "insulin": 15, "no food for": 12, "since yesterday": 6, "two days": 10, "2 days": 10,
}

CATEGORY_WEIGHT = {"rescue": 15, "medicine": 12, "water": 10, "shelter": 8, "food": 7, "transport": 5,
                   "clothing": 2, "other": 2}

# Vulnerability words detected in free text when the requester did not tick the boxes.
TEXT_VULNERABILITY = {
    "elderly": ["elderly", "old age", "grandmother", "grandfather", "grandma", "grandpa", "aged", "senior", "paati", "thatha"],
    "children": ["child", "children", "baby", "babies", "infant", "toddler", "kids", "newborn", "kuzhandhai"],
    "disabled": ["wheelchair", "disabled", "disability", "bedridden", "paralysed", "paralyzed", "blind", "deaf", "cannot walk"],
    "pregnant": ["pregnant", "pregnancy", "labour", "labor"],
}

LEVELS = [(70, "critical"), (48, "high"), (28, "medium"), (0, "low")]

DISCLAIMER = ("Advisory recommendation only - not medically validated emergency triage. "
              "An authorised coordinator makes the final decision.")


def recommend(*, description: str, category: str, people_affected: int = 1, created_at: datetime | None = None,
              now: datetime | None = None, has_elderly=False, has_children=False, has_disabled=False,
              has_medical_condition=False, has_pregnant=False, alternative_supply_ratio: float | None = None,
              is_sos: bool = False) -> dict:
    factors = []
    score = 0.0
    norm = normalise(description)

    # 1. Immediate danger indicators (capped)
    danger_hits = [(t, w) for t, w in DANGER_TERMS.items() if re.search(rf"\b{re.escape(t)}\b", norm)]
    if danger_hits:
        pts = min(50, sum(w for _, w in sorted(danger_hits, key=lambda x: -x[1])[:2]))
        score += pts
        factors.append({"factor": "Immediate danger indicators",
                        "detail": ", ".join(t for t, _ in danger_hits[:4]), "points": pts})
    if is_sos:
        score += 35
        factors.append({"factor": "One-touch SOS alert", "detail": "Person used emergency SOS", "points": 35})

    # 2. Number of people affected (log scale, max 18)
    n = max(1, int(people_affected or 1))
    pts = round(min(18, 6 * math.log10(n) * 1.5), 1)
    if pts:
        score += pts
        factors.append({"factor": "People affected", "detail": f"{n} people", "points": pts})

    # 3. Vulnerability (max 22) - from the form, or detected in the text
    inferred = {k for k, words in TEXT_VULNERABILITY.items()
                if any(re.search(r"\b" + re.escape(w) + r"\b", norm) for w in words)}
    has_elderly = has_elderly or "elderly" in inferred
    has_children = has_children or "children" in inferred
    has_disabled = has_disabled or "disabled" in inferred
    has_pregnant = has_pregnant or "pregnant" in inferred
    vul = []
    if has_elderly: vul.append(("elderly", 6))
    if has_children: vul.append(("children", 5))
    if has_disabled: vul.append(("person with disability", 7))
    if has_medical_condition: vul.append(("medical condition", 7))
    if has_pregnant: vul.append(("pregnant woman", 7))
    if vul:
        pts = min(22, sum(w for _, w in vul))
        score += pts
        detail = ", ".join(v for v, _ in vul) + (" (some detected in text)" if inferred else "")
        factors.append({"factor": "Vulnerability", "detail": detail, "points": pts})

    # 4. Requested assistance category
    cw = CATEGORY_WEIGHT.get(category, 2)
    score += cw
    factors.append({"factor": "Assistance category", "detail": category, "points": cw})

    # 5. Waiting time (max 15)
    if created_at:
        now = now or datetime.now(timezone.utc).replace(tzinfo=None)
        hours = max(0.0, (now - created_at).total_seconds() / 3600)
        pts = round(min(15, hours * 1.25), 1)
        if pts >= 1:
            score += pts
            factors.append({"factor": "Waiting time", "detail": f"{hours:.1f} hours since submission", "points": pts})

    # 6. Alternative support available nearby
    if alternative_supply_ratio is not None:
        if alternative_supply_ratio >= 1.5:
            score -= 8
            factors.append({"factor": "Alternative support nearby",
                            "detail": f"nearby supply covers {alternative_supply_ratio:.1f}x demand", "points": -8})
        elif alternative_supply_ratio < 0.5:
            score += 6
            factors.append({"factor": "Local shortage",
                            "detail": f"nearby supply covers only {alternative_supply_ratio:.0%} of demand",
                            "points": 6})

    score = round(max(0.0, min(100.0, score)), 1)
    level = next(lvl for threshold, lvl in LEVELS if score >= threshold)
    return {"level": level, "score": score, "factors": factors, "disclaimer": DISCLAIMER,
            "thresholds": {"critical": 70, "high": 48, "medium": 28, "low": 0}}
