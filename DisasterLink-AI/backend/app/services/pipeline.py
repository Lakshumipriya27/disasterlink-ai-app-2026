"""Intake pipeline run on every new emergency request (online submission or offline sync)."""
import math
from datetime import timedelta

from sqlalchemy.orm import Session

from ..ai import classifier, duplicates, external, urgency
from ..models import EmergencyRequest, utcnow
from .audit import notify
from .geo import nearest_area
from .matching import REQUEST_TO_RESOURCE, demand_supply


def default_quantity(category: str, people: int) -> int:
    """Units needed if the requester did not specify: 1 vehicle/boat per 8 people, 1 shelter kit per family of 4,
    otherwise 1 unit per person."""
    people = max(1, people or 1)
    if category in ("transport", "rescue"):
        return math.ceil(people / 8)
    if category == "shelter":
        return math.ceil(people / 4)
    return people


def request_to_dict(r: EmergencyRequest) -> dict:
    return {"id": r.id, "description": r.description or "", "lat": r.lat, "lng": r.lng, "area": r.area,
            "contact_phone": r.contact_phone, "category": r.category, "created_at": r.created_at, "status": r.status}


def supply_ratio_for(db: Session, req: EmergencyRequest) -> float | None:
    cats = REQUEST_TO_RESOURCE.get(req.category, [])
    if not cats or not req.area:
        return None
    for row in demand_supply(db):
        if row["area"] == req.area and row["category"] in cats:
            demand = row["verified_demand"] + row["unverified_demand"]
            return row["supply"] / demand if demand else None
    return 0.0


def compute_urgency(db: Session, req: EmergencyRequest, is_sos: bool = False) -> dict:
    return urgency.recommend(
        description=req.description, category=req.category, people_affected=req.people_affected,
        created_at=req.created_at, has_elderly=req.has_elderly, has_children=req.has_children,
        has_disabled=req.has_disabled, has_medical_condition=req.has_medical_condition, has_pregnant=req.has_pregnant,
        alternative_supply_ratio=supply_ratio_for(db, req), is_sos=is_sos)


def process_new_request(db: Session, req: EmergencyRequest, hint_category: str | None = None,
                        is_sos: bool = False, use_external: bool = True) -> dict:
    if not req.area and req.lat is not None:
        req.area = nearest_area(req.lat, req.lng)
    result = classifier.classify(req.description, hint_category)
    if use_external:
        result = external.enhance(req.description, result)
    req.category = result["category"]
    req.categories = result["categories"]
    req.keywords = result["keywords"]
    req.classification_confidence = result["confidence"]
    req.classification_explanation = result["explanation"]
    req.classification_engine = result["engine"]
    if (not req.people_affected or req.people_affected <= 1):
        n = classifier.extract_people_count(req.description)
        if n:
            req.people_affected = n
    if not req.quantity_needed or req.quantity_needed <= 1:
        req.quantity_needed = default_quantity(req.category, req.people_affected)
    if req.created_at is None:
        req.created_at = utcnow()
    u = compute_urgency(db, req, is_sos=is_sos)
    req.urgency_recommended = u["level"]
    req.urgency_score = u["score"]
    req.urgency_factors = u["factors"]

    since = utcnow() - timedelta(hours=72)
    cands = (db.query(EmergencyRequest)
             .filter(EmergencyRequest.created_at >= since, EmergencyRequest.status != "duplicate",
                     EmergencyRequest.id != req.id).all())
    dups = duplicates.find_duplicates(request_to_dict(req), [request_to_dict(c) for c in cands])
    if dups:
        req.duplicate_of = dups[0]["id"]
        req.duplicate_score = dups[0]["score"]
        notify(db, "duplicate", f"Possible duplicate: {req.id}",
               f"{req.id} looks {dups[0]['score']:.0%} similar to {dups[0]['id']}. Coordinator review needed.",
               "info", req.id)
    if req.urgency_recommended == "critical":
        notify(db, "critical", f"Critical request {req.id} in {req.area or 'unknown area'}",
               (req.description or "")[:200], "critical", req.id)
    return {"classification": result, "urgency": u, "duplicates": dups}
