from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai import classifier, duplicates, external, urgency
from ..database import get_db
from ..models import EmergencyRequest, User
from ..security import get_optional_user, OPERATIONS, require_operations
from ..serializers import request_out
from ..services.pipeline import request_to_dict

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    category_hint: str | None = None
    people_affected: int = Field(default=1, ge=1, le=10000)
    has_elderly: bool = False
    has_children: bool = False
    has_disabled: bool = False
    has_medical_condition: bool = False
    has_pregnant: bool = False
    lat: float | None = None
    lng: float | None = None
    use_external: bool = False


@router.post("/analyze", summary="Classify text + urgency recommendation (+ duplicates for operations roles)")
def analyze(body: AnalyzeIn, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    c = classifier.classify(body.text, body.category_hint)
    if body.use_external:
        c = external.enhance(body.text, c)
    people = body.people_affected
    if people <= 1:
        people = classifier.extract_people_count(body.text) or people
    u = urgency.recommend(description=body.text, category=c["category"], people_affected=people,
                          has_elderly=body.has_elderly, has_children=body.has_children,
                          has_disabled=body.has_disabled, has_medical_condition=body.has_medical_condition,
                          has_pregnant=body.has_pregnant)
    out = {"classification": c, "urgency": u, "people_detected": people}
    if user and user.role_name in OPERATIONS:
        target = {"id": None, "description": body.text, "lat": body.lat, "lng": body.lng, "area": "",
                  "contact_phone": "", "category": c["category"], "created_at": None}
        cands = db.query(EmergencyRequest).filter(EmergencyRequest.status != "duplicate").all()
        out["duplicates"] = duplicates.find_duplicates(target, [request_to_dict(x) for x in cands], threshold=0.45)
    return out


@router.get("/status")
def ai_status():
    return {"local_engine": "rule-based NLP (always available, works offline)", "external": external.status()}


@router.get("/duplicates", summary="Requests flagged as possible duplicates awaiting coordinator review")
def flagged(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    rows = db.query(EmergencyRequest).filter(EmergencyRequest.duplicate_of.isnot(None)).all()
    out = []
    for r in rows:
        orig = db.get(EmergencyRequest, r.duplicate_of)
        if not orig:
            continue
        s, reasons = duplicates.similarity(request_to_dict(r), request_to_dict(orig))
        out.append({"request": request_out(r, user.role_name), "original": request_out(orig, user.role_name),
                    "score": r.duplicate_score or s, "reasons": reasons, "confirmed": r.status == "duplicate"})
    out.sort(key=lambda x: (x["confirmed"], -x["score"]))
    return out


@router.get("/insights")
def insights(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    reqs = db.query(EmergencyRequest).all()
    kw = Counter()
    for r in reqs:
        kw.update(r.keywords or [])
    low_conf = sorted([r for r in reqs if r.classification_confidence < 0.55 and r.status == "pending"],
                      key=lambda r: r.classification_confidence)[:10]
    overrides = [r for r in reqs if r.urgency_override]
    conf_buckets = Counter()
    for r in reqs:
        c = r.classification_confidence
        conf_buckets["<50%" if c < 0.5 else "50-70%" if c < 0.7 else "70-85%" if c < 0.85 else ">85%"] += 1
    agree = sum(1 for r in overrides if r.urgency_override == r.urgency_recommended)
    return {
        "top_keywords": [{"keyword": k, "count": v} for k, v in kw.most_common(15)],
        "confidence_distribution": [{"bucket": b, "count": conf_buckets.get(b, 0)}
                                    for b in ("<50%", "50-70%", "70-85%", ">85%")],
        "low_confidence_queue": [request_out(r, user.role_name) for r in low_conf],
        "overrides": [request_out(r, user.role_name) for r in overrides],
        "override_count": len(overrides), "override_agreement": agree,
        "category_labels": classifier.CATEGORY_LABELS,
        "urgency_thresholds": {"critical": 70, "high": 48, "medium": 28, "low": 0},
        "disclaimer": urgency.DISCLAIMER,
    }
