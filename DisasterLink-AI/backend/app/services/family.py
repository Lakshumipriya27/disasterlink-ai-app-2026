"""Family reconnection: similarity-based match suggestions between 'missing' and 'found' reports.
Suggestions are private to coordinators; identity/contact disclosure needs verification + consent."""
from sqlalchemy.orm import Session

from ..ai.classifier import STOPWORDS, tokenize
from ..ai.duplicates import _cosine, _trigrams
from ..models import FamilyMatchSuggestion, MissingPersonReport
from .geo import haversine_km


def score_pair(m: MissingPersonReport, f: MissingPersonReport) -> tuple[float, list[str]]:
    reasons = []
    name = _cosine(_trigrams(m.person_name), _trigrams(f.person_name))
    s = 0.4 * name
    reasons.append(f"Name similarity {name:.0%}")
    if m.age is not None and f.age is not None:
        diff = abs(m.age - f.age)
        a = 1.0 if diff <= 2 else 0.6 if diff <= 5 else 0.0
        s += 0.2 * a
        reasons.append(f"Age difference {diff} years")
    if m.gender and f.gender and m.gender.lower() == f.gender.lower():
        s += 0.1
        reasons.append("Same gender")
    d = haversine_km(m.lat, m.lng, f.lat, f.lng)
    if d != float("inf"):
        s += 0.15 * max(0.0, 1 - d / 15)
        reasons.append(f"Last seen / found {d:.1f} km apart")
    if m.last_seen_at and f.last_seen_at and f.last_seen_at >= m.last_seen_at:
        s += 0.05
        reasons.append("Found after last-seen time")
    ta = {t for t in tokenize(m.description) if t not in STOPWORDS}
    tb = {t for t in tokenize(f.description) if t not in STOPWORDS}
    if ta and tb:
        j = len(ta & tb) / len(ta | tb)
        s += 0.1 * min(1.0, j * 2)
        if j:
            reasons.append(f"Description overlap: {', '.join(sorted(ta & tb)[:4])}")
    return round(min(1.0, s), 3), reasons


def refresh_suggestions(db: Session, threshold: float = 0.45) -> int:
    open_reports = db.query(MissingPersonReport).filter(MissingPersonReport.status == "open").all()
    missing = [r for r in open_reports if r.report_type == "missing"]
    found = [r for r in open_reports if r.report_type == "found"]
    existing = {(x.missing_report_id, x.found_report_id) for x in db.query(FamilyMatchSuggestion).all()}
    n = 0
    for m in missing:
        for f in found:
            if (m.id, f.id) in existing:
                continue
            s, reasons = score_pair(m, f)
            if s >= threshold:
                db.add(FamilyMatchSuggestion(missing_report_id=m.id, found_report_id=f.id, score=s, explanation=reasons))
                n += 1
    db.flush()
    return n
