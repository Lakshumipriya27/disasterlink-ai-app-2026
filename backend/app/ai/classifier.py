"""Rule-based NLP request classifier (local, deterministic, explainable).

Pipeline: normalise -> tokenise -> match weighted keyword/phrase lexicons per category
(English + common Tamil transliterations) -> score -> pick primary + secondary categories.
Every decision is returned with the keywords that caused it, so coordinators can see *why*.
"""
import re
from collections import defaultdict

CATEGORIES = ["food", "water", "medicine", "shelter", "transport", "clothing", "rescue", "other"]

CATEGORY_LABELS = {
    "food": "Food", "water": "Drinking water", "medicine": "Medicine", "shelter": "Shelter",
    "transport": "Transportation", "clothing": "Clothing", "rescue": "Rescue assistance", "other": "Other support",
}

# keyword -> weight. Multi-word phrases are matched on the normalised text.
LEXICON = {
    "food": {"food": 3, "hungry": 3, "hunger": 3, "starving": 4, "meal": 2, "meals": 2, "rice": 2, "eat": 2,
             "eaten": 2, "ration": 2, "rations": 2, "groceries": 2, "milk": 2, "baby food": 3, "biscuits": 1,
             "bread": 1, "saapadu": 3, "sapadu": 3, "unavu": 3, "no food": 4, "cooked food": 3, "food packets": 3},
    "water": {"water": 2, "drinking water": 4, "thirsty": 3, "thanni": 3, "kudineer": 3, "bottled water": 3,
              "dehydrated": 3, "dehydration": 3, "clean water": 3, "no water": 3, "water cans": 3, "potable": 3},
    "medicine": {"medicine": 4, "medicines": 4, "medical": 3, "insulin": 4, "tablet": 3, "tablets": 3,
                 "doctor": 3, "fever": 3, "injured": 3, "injury": 3, "wound": 3, "bleeding": 3, "diabetic": 3,
                 "diabetes": 3, "bp": 2, "blood pressure": 3, "dialysis": 4, "oxygen": 4, "inhaler": 3, "asthma": 3,
                 "first aid": 3, "pregnant": 2, "marunthu": 3, "maruthuvar": 3, "sick": 2, "pain": 2,
                 "infection": 3, "diarrhoea": 3, "diarrhea": 3, "medicine kit": 4, "prescription": 3},
    "shelter": {"shelter": 4, "homeless": 4, "house collapsed": 4, "roof": 2, "flooded house": 3,
                "house flooded": 3, "place to stay": 4, "relief camp": 3, "camp": 2, "tent": 3, "tarpaulin": 3,
                "displaced": 3, "evacuate": 2, "nowhere to stay": 4, "veedu": 2, "stay": 1},
    "transport": {"transport": 4, "vehicle": 3, "ambulance": 3, "boat": 3, "evacuation": 2, "ride": 2,
                  "stranded": 2, "hospital transfer": 3, "pickup": 2, "wheelchair transport": 4, "lorry": 2,
                  "van": 2, "move to": 1},
    "clothing": {"clothes": 4, "clothing": 4, "blanket": 3, "blankets": 3, "dress": 2, "saree": 2,
                 "dry clothes": 4, "bedsheet": 2, "mat": 1, "towel": 2, "cold": 1, "thuni": 3, "udai": 3},
    "rescue": {"trapped": 5, "rescue": 5, "drowning": 6, "stuck": 3, "rising water": 4, "water rising": 4,
               "neck deep": 5, "chest deep": 4, "roof top": 4, "rooftop": 4, "terrace": 2, "collapsed": 4,
               "swept away": 6, "cannot get out": 5, "can't get out": 5, "help us": 2, "sos": 3,
               "unconscious": 5, "electric shock": 5, "electrocuted": 5, "current": 1, "kaapathunga": 4,
               "kapathunga": 4, "marooned": 4, "cut off": 3},
}

STOPWORDS = set("""a an the and or but if is are was were be been am i we you they he she it my our your their
of to in on at for from with by this that these those there here please need needs needed help some any
very have has had do does did not no can could would should will shall just only also so""".split())


def normalise(text: str) -> str:
    text = (text or "").lower()
    text = text.replace("’", "'")
    text = re.sub(r"[^a-z0-9'\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    return [t for t in normalise(text).split() if t]


def extract_keywords(text: str, limit: int = 8) -> list[str]:
    """Simple keyword extraction: lexicon hits first, then frequent non-stopword tokens."""
    norm = normalise(text)
    hits = []
    for cat_terms in LEXICON.values():
        for term in cat_terms:
            if re.search(rf"\b{re.escape(term)}\b", norm) and term not in hits:
                hits.append(term)
    freq = defaultdict(int)
    for t in tokenize(text):
        if t not in STOPWORDS and len(t) > 3 and not t.isdigit():
            freq[t] += 1
    for t, _ in sorted(freq.items(), key=lambda kv: (-kv[1], kv[0])):
        if t not in hits and not any(t in h for h in hits):
            hits.append(t)
    return hits[:limit]


def extract_people_count(text: str) -> int | None:
    norm = normalise(text)
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
             "ten": 10, "twelve": 12, "fifteen": 15, "twenty": 20, "thirty": 30, "fifty": 50, "hundred": 100}
    m = re.search(r"\b(\d{1,4})\s*(people|persons|families|family members|members|residents|children|kids|"
                  r"elders|households|of us|adults)\b", norm)
    if m:
        n = int(m.group(1))
        return n * 4 if "famil" in m.group(2) or "household" in m.group(2) else n
    m = re.search(r"\b(" + "|".join(words) + r")\s*(people|persons|families|members|of us|children)\b", norm)
    if m:
        n = words[m.group(1)]
        return n * 4 if "famil" in m.group(2) else n
    return None


def classify(text: str, hint_category: str | None = None) -> dict:
    norm = normalise(text)
    scores: dict[str, float] = defaultdict(float)
    matched: dict[str, list[str]] = defaultdict(list)
    for cat, terms in LEXICON.items():
        for term, w in terms.items():
            n = len(re.findall(rf"\b{re.escape(term)}\b", norm))
            if n:
                scores[cat] += w * min(n, 2)
                matched[cat].append(term)

    explanation = []
    if hint_category and hint_category in CATEGORIES and hint_category != "other":
        scores[hint_category] += 3
        explanation.append(f"Requester selected '{CATEGORY_LABELS[hint_category]}' (+3 weight).")

    if not scores:
        return {
            "category": hint_category if hint_category in CATEGORIES else "other",
            "categories": [hint_category] if hint_category in CATEGORIES else ["other"],
            "scores": {}, "confidence": 0.2, "keywords": extract_keywords(text),
            "explanation": explanation + ["No category keywords found; classified as 'Other support'. "
                                          "Coordinator review recommended."],
            "engine": "rule-based",
        }

    total = sum(scores.values())
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    primary, top = ranked[0]
    secondary = [c for c, s in ranked[1:] if s >= max(3, 0.35 * top)]
    confidence = round(min(0.97, 0.45 + 0.5 * (top / total) * min(1.0, top / 6)), 2)

    for cat, s in ranked:
        if matched[cat]:
            explanation.append(f"{CATEGORY_LABELS[cat]}: matched {', '.join(repr(m) for m in matched[cat][:5])} "
                               f"(score {s:g}).")
    explanation.insert(0, f"Primary category '{CATEGORY_LABELS[primary]}' had the highest keyword score.")
    return {
        "category": primary,
        "categories": [primary] + secondary,
        "scores": {c: round(s, 1) for c, s in ranked},
        "confidence": confidence,
        "keywords": extract_keywords(text),
        "explanation": explanation,
        "engine": "rule-based",
    }
