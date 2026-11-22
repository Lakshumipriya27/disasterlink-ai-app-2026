"""Need-aware resource matching engine.

1. demand_supply(): compares verified demand with available supply per area x category to find
   shortages (e.g. "80 people need drinking water, only 20 units available").
2. generate_suggestions(): for each open verified request, ranks candidate resources by
   category fit, distance, coverage, urgency and expiry (use stock that expires first) and stores
   a *suggested* match. Nothing is allocated until a human coordinator approves it.
"""
from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import EmergencyRequest, Resource, ResourceMatch, utcnow
from .geo import AREAS, haversine_km

REQUEST_TO_RESOURCE = {
    "food": ["food"], "water": ["water"], "medicine": ["medicine"], "shelter": ["shelter"],
    "transport": ["transport"], "clothing": ["clothing"], "rescue": ["transport"], "other": [],
}
OPEN_STATUSES = ("pending", "verified", "in_progress")
ACTIVE_MATCH = ("suggested", "awaiting_approval", "approved", "dispatched")
URGENCY_WEIGHT = {"critical": 1.0, "high": 0.75, "medium": 0.45, "low": 0.2}
MAX_DISTANCE_KM = 30.0


def usable_resources(db: Session) -> list[Resource]:
    now = utcnow()
    out = []
    for r in db.query(Resource).all():
        if r.availability == "depleted" or r.available_quantity <= 0:
            continue
        if r.expiry_date and r.expiry_date < now:
            continue
        out.append(r)
    return out


def demand_supply(db: Session) -> list[dict]:
    reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status.in_(OPEN_STATUSES)).all()
    resources = usable_resources(db)
    rows: dict[tuple, dict] = {}

    def row(area, cat):
        key = (area, cat)
        if key not in rows:
            rows[key] = {"area": area, "category": cat, "verified_demand": 0, "unverified_demand": 0,
                         "verified_requests": 0, "unverified_requests": 0, "supply": 0, "committed": 0}
        return rows[key]

    for r in reqs:
        for rc in REQUEST_TO_RESOURCE.get(r.category, []):
            x = row(r.area or "Other", rc)
            if r.verification_status == "verified":
                x["verified_demand"] += r.quantity_needed
                x["verified_requests"] += 1
            else:
                x["unverified_demand"] += r.quantity_needed
                x["unverified_requests"] += 1
    for res in resources:
        x = row(res.area or "Other", res.category)
        x["supply"] += res.available_quantity
        x["committed"] += res.reserved_quantity

    out = []
    for x in rows.values():
        d = x["verified_demand"]
        x["gap"] = max(0, d - x["supply"])
        x["coverage"] = round(x["supply"] / d, 2) if d else None
        if d and x["supply"] < d:
            x["status"] = "critical_shortage" if x["supply"] < 0.4 * d else "shortage"
        elif d == 0 and x["supply"] > 0:
            x["status"] = "no_verified_demand"
        elif d and x["supply"] > 2.5 * d:
            x["status"] = "surplus"
        else:
            x["status"] = "adequate"
        if x["status"] in ("shortage", "critical_shortage"):
            x["summary"] = (f"{x['area']}: {d} units of verified {x['category']} demand, "
                            f"only {x['supply']} available (gap {x['gap']}).")
        out.append(x)
    order = {"critical_shortage": 0, "shortage": 1, "adequate": 2, "surplus": 3, "no_verified_demand": 4}
    out.sort(key=lambda x: (order[x["status"]], -x["gap"]))
    return out


def _score_candidate(req: EmergencyRequest, res: Resource, remaining: int, now: datetime):
    d = haversine_km(req.lat, req.lng, res.lat, res.lng)
    if d == float("inf"):
        a1, a2 = AREAS.get(req.area), AREAS.get(res.area)
        d = haversine_km(*a1, *a2) if a1 and a2 else 15.0
    if d > MAX_DISTANCE_KM:
        return None
    dist_score = max(0.0, 1 - d / MAX_DISTANCE_KM)
    qty = min(remaining, req.quantity_needed)
    coverage = qty / max(1, req.quantity_needed)
    urgency = URGENCY_WEIGHT.get(req.urgency, 0.4)
    expiry_bonus = 0.0
    if res.expiry_date:
        days = (res.expiry_date - now).days
        if days <= 14:
            expiry_bonus = 1.0 - max(0, days) / 14
    score = 0.40 * dist_score + 0.30 * coverage + 0.20 * urgency + 0.10 * expiry_bonus
    expl = [
        f"Category match: request '{req.category}' -> resource '{res.category}'.",
        f"Distance {d:.1f} km from {res.location_name or res.area} to {req.location_name or req.area}.",
        f"Can supply {qty} of {req.quantity_needed} {res.unit} needed ({coverage:.0%} coverage).",
        f"Request urgency '{req.urgency}' (weight {urgency}).",
    ]
    if expiry_bonus:
        expl.append(f"Stock expires in {max(0, (res.expiry_date - now).days)} days - using it first reduces wastage.")
    if coverage < 1:
        expl.append("Partial coverage - an additional source will be needed.")
    return {"score": round(score, 3), "distance_km": round(d, 2), "quantity": qty, "explanation": expl}


def generate_suggestions(db: Session, actor: str = "system") -> list[ResourceMatch]:
    now = utcnow()
    active = {m.request_id for m in db.query(ResourceMatch).filter(ResourceMatch.status.in_(ACTIVE_MATCH)).all()}
    reqs = (db.query(EmergencyRequest)
            .filter(EmergencyRequest.status.in_(("verified", "in_progress")),
                    EmergencyRequest.verification_status == "verified").all())
    reqs = [r for r in reqs if r.id not in active and REQUEST_TO_RESOURCE.get(r.category)]
    reqs.sort(key=lambda r: -URGENCY_WEIGHT.get(r.urgency, 0))
    resources = usable_resources(db)
    remaining = {r.id: r.available_quantity for r in resources}
    created = []
    for req in reqs:
        best = None
        for res in resources:
            if res.category not in REQUEST_TO_RESOURCE[req.category] or remaining[res.id] <= 0:
                continue
            s = _score_candidate(req, res, remaining[res.id], now)
            if s and (best is None or s["score"] > best[1]["score"]):
                best = (res, s)
        if not best:
            continue
        res, s = best
        remaining[res.id] -= s["quantity"]
        m = ResourceMatch(request_id=req.id, resource_id=res.id, quantity=s["quantity"], distance_km=s["distance_km"],
                          score=s["score"], explanation=s["explanation"], status="suggested",
                          destination=req.location_name or req.area)
        db.add(m)
        created.append(m)
    db.flush()
    return created
