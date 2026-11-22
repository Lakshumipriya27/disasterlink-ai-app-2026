from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (DisasterScenario, EmergencyRequest, Notification, Resource, ResourceMatch, Shelter, SOSAlert,
                      SynchronizationRecord, User, Volunteer, VulnerablePerson, utcnow)
from ..security import STAFF, get_current_user, require_operations
from ..serializers import iso, request_out, resource_out, shelter_out
from ..services.matching import demand_supply, usable_resources
from ..services.unreported import detect

router = APIRouter(prefix="/api/analytics", tags=["Dashboard & Analytics"])

URG_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _filtered(db, category=None, area=None, urgency=None, status=None):
    q = db.query(EmergencyRequest)
    if category: q = q.filter(EmergencyRequest.category == category)
    if area: q = q.filter(EmergencyRequest.area == area)
    if status: q = q.filter(EmergencyRequest.status == status)
    rows = q.all()
    if urgency:
        rows = [r for r in rows if r.urgency == urgency]
    return rows


@router.get("/dashboard", summary="Command center statistics computed from live data")
def dashboard(category: str | None = None, area: str | None = None, urgency: str | None = None,
              status: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    reqs = _filtered(db, category, area, urgency, status)
    active = [r for r in reqs if r.status not in ("duplicate", "rejected")]
    resources = usable_resources(db)
    if area:
        resources = [r for r in resources if r.area == area]
    if category:
        resources = [r for r in resources if r.category == category]
    matches = db.query(ResourceMatch).all()
    underserved = detect(db)
    shortages = [s for s in demand_supply(db) if s["status"] in ("shortage", "critical_shortage")]
    if area:
        shortages = [s for s in shortages if s["area"] == area]

    stats = {
        "total_requests": len(reqs),
        "verified": sum(1 for r in reqs if r.verification_status == "verified"),
        "pending": sum(1 for r in reqs if r.status == "pending"),
        "critical": sum(1 for r in active if r.urgency == "critical" and r.status != "fulfilled"),
        "high": sum(1 for r in active if r.urgency == "high" and r.status != "fulfilled"),
        "fulfilled": sum(1 for r in reqs if r.status == "fulfilled"),
        "in_progress": sum(1 for r in reqs if r.status == "in_progress"),
        "duplicates": sum(1 for r in reqs if r.status == "duplicate"),
        "available_resource_units": sum(r.available_quantity for r in resources),
        "resource_records": len(resources),
        "pending_matches": sum(1 for m in matches if m.status in ("suggested", "awaiting_approval")),
        "underserved_areas": sum(1 for a in underserved["areas"] if a["level"] in ("high", "moderate")),
        "offline_synced": sum(1 for r in reqs if r.synced_from_offline),
        "sos_open": db.query(SOSAlert).filter(SOSAlert.assistance_status.notin_(("assisted", "closed"))).count(),
        "people_affected": sum(r.people_affected for r in active),
    }
    by_cat = Counter(r.category for r in active)
    by_status = Counter(r.status for r in reqs)
    by_urg = Counter(r.urgency for r in active if r.status != "fulfilled")
    res_cat = defaultdict(int)
    for r in resources:
        res_cat[r.category] += r.available_quantity
    demand_cat = defaultdict(int)
    for r in active:
        if r.status != "fulfilled":
            demand_cat[r.category] += r.quantity_needed

    # Hourly timeline over last 48h (created vs fulfilled)
    now = utcnow()
    buckets = {}
    for i in range(24, -1, -1):
        t = (now - timedelta(hours=2 * i)).replace(minute=0, second=0, microsecond=0)
        buckets[t] = {"time": iso(t), "requests": 0, "sos": 0, "critical": 0}
    keys = sorted(buckets)

    def bucket(dt):
        for k in reversed(keys):
            if dt >= k:
                return buckets[k]
        return None
    for r in reqs:
        b = bucket(r.created_at)
        if b:
            b["requests"] += 1
            if r.source == "sos": b["sos"] += 1
            if r.urgency == "critical": b["critical"] += 1

    geo = defaultdict(lambda: {"requests": 0, "people": 0, "critical": 0})
    for r in active:
        g = geo[r.area or "Unknown"]
        g["requests"] += 1
        g["people"] += r.people_affected
        if r.urgency == "critical": g["critical"] += 1

    urgent = sorted([r for r in active if r.status in ("pending", "verified", "in_progress")
                     and r.urgency in ("critical", "high")],
                    key=lambda r: (URG_ORDER[r.urgency], r.created_at))[:8]
    recent = sorted(reqs, key=lambda r: r.created_at, reverse=True)[:10]
    return {
        "stats": stats,
        "category_chart": [{"category": k, "count": v} for k, v in by_cat.most_common()],
        "status_chart": [{"status": k, "count": v} for k, v in by_status.most_common()],
        "urgency_chart": [{"urgency": k, "count": by_urg.get(k, 0)} for k in ("critical", "high", "medium", "low")],
        "resource_chart": [{"category": c, "available": res_cat.get(c, 0), "demand": demand_cat.get(c, 0)}
                           for c in ("food", "water", "medicine", "shelter", "transport", "clothing")],
        "timeline": [buckets[k] for k in keys],
        "geo_demand": sorted([{"area": k, **v} for k, v in geo.items()], key=lambda x: -x["requests"]),
        "urgent": [request_out(r, user.role_name) for r in urgent],
        "recent": [request_out(r, user.role_name) for r in recent],
        "shortage_alerts": shortages[:8],
        "underserved": [a for a in underserved["areas"] if a["level"] != "low"][:5],
        "generated_at": iso(now),
    }


@router.get("/map", summary="All map layers; vulnerable-person layer only for coordinators/admin")
def map_layers(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    staff = user.role_name in STAFF
    reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status.notin_(("duplicate", "rejected"))).all()
    sc = db.query(DisasterScenario).filter(DisasterScenario.is_active.is_(True)).first()
    und = detect(db)
    vps = db.query(VulnerablePerson).filter(VulnerablePerson.consent_status == "given").all() if staff else []
    return {
        "requests": [{"id": r.id, "lat": r.lat, "lng": r.lng, "category": r.category, "urgency": r.urgency,
                      "status": r.status, "area": r.area, "source": r.source, "people": r.people_affected,
                      "description": (r.description or "")[:140], "verification": r.verification_status,
                      "is_simulated": r.is_simulated} for r in reqs if r.lat is not None],
        "sos": [{"id": s.id, "lat": s.lat, "lng": s.lng, "category": s.category, "status": s.assistance_status,
                 "created_at": iso(s.created_at), "silent": s.silent}
                for s in db.query(SOSAlert).all() if s.lat is not None],
        "resources": [resource_out(r) for r in db.query(Resource).all() if r.lat is not None],
        "shelters": [shelter_out(s) for s in db.query(Shelter).all()],
        "impact_zones": sc.impact_zones if sc else [],
        "underserved": [{"area": a["area"], "lat": a["lat"], "lng": a["lng"], "level": a["level"],
                         "score": a["underserved_score"]} for a in und["areas"]],
        "vulnerable": [{"id": v.id, "lat": v.lat, "lng": v.lng, "area": v.area, "categories": v.categories,
                        "display_name": v.display_name, "requirements": v.assistance_requirements}
                       for v in vps if v.lat is not None],
        "vulnerable_layer_restricted": not staff,
    }


@router.get("/impact", summary="Disaster impact intelligence (estimates from simulated data)")
def impact(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    und = detect(db)
    shelters = db.query(Shelter).all()
    reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status.notin_(("duplicate", "rejected"))).all()
    shelter_by_area = defaultdict(lambda: {"capacity": 0, "occupancy": 0})
    for s in shelters:
        shelter_by_area[s.area]["capacity"] += s.capacity
        shelter_by_area[s.area]["occupancy"] += s.occupancy
    cat_by_area = defaultdict(Counter)
    for r in reqs:
        cat_by_area[r.area][r.category] += r.quantity_needed
    heat = [{"lat": r.lat, "lng": r.lng, "weight": {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.3}[r.urgency]}
            for r in reqs if r.lat is not None and r.status != "fulfilled"]
    areas = []
    for a in und["areas"]:
        sh = shelter_by_area[a["area"]]
        areas.append({**a, "shelter_capacity": sh["capacity"], "shelter_occupancy": sh["occupancy"],
                      "demand_by_category": dict(cat_by_area[a["area"]])})
    return {"scenario": und["scenario"], "assumptions": und["assumptions"], "areas": areas, "heat": heat,
            "disclaimer": "Estimates derived from SIMULATED data for demonstration. Not official disaster warnings."}


@router.get("/summary", summary="Analytics page aggregates")
def summary(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    reqs = db.query(EmergencyRequest).all()
    matches = db.query(ResourceMatch).all()
    fulfilled = [r for r in reqs if r.status == "fulfilled"]
    resp_times = [(r.updated_at - r.created_at).total_seconds() / 3600 for r in fulfilled if r.updated_at]
    by_area_status = defaultdict(Counter)
    for r in reqs:
        by_area_status[r.area or "Unknown"][r.status] += 1
    src = Counter(r.source for r in reqs)
    eng = Counter(r.classification_engine for r in reqs)
    overrides = sum(1 for r in reqs if r.urgency_override)
    conf = [r.classification_confidence for r in reqs]
    shelters = db.query(Shelter).all()
    return {
        "totals": {"requests": len(reqs), "fulfilled": len(fulfilled),
                   "fulfilment_rate": round(len(fulfilled) / len(reqs), 3) if reqs else 0,
                   "avg_hours_to_fulfil": round(sum(resp_times) / len(resp_times), 1) if resp_times else None,
                   "urgency_overrides": overrides,
                   "avg_classification_confidence": round(sum(conf) / len(conf), 2) if conf else None,
                   "matches_total": len(matches),
                   "matches_fulfilled": sum(1 for m in matches if m.status == "fulfilled"),
                   "volunteers": db.query(Volunteer).count(),
                   "vulnerable_registered": db.query(VulnerablePerson).filter(
                       VulnerablePerson.consent_status == "given").count(),
                   "shelter_capacity": sum(s.capacity for s in shelters),
                   "shelter_occupancy": sum(s.occupancy for s in shelters),
                   "offline_synced": sum(1 for r in reqs if r.synced_from_offline)},
        "area_status": [{"area": a, **dict(c)} for a, c in sorted(by_area_status.items())],
        "sources": [{"source": k, "count": v} for k, v in src.items()],
        "engines": [{"engine": k, "count": v} for k, v in eng.items()],
        "match_funnel": [{"stage": s, "count": sum(1 for m in matches if m.status == s)}
                         for s in ("suggested", "awaiting_approval", "approved", "dispatched", "fulfilled", "rejected")],
        "shelters": [{"name": s.name, "capacity": s.capacity, "occupancy": s.occupancy} for s in shelters],
    }


notif_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@notif_router.get("")
def notifications(unread_only: bool = False, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    q = db.query(Notification)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return [{"id": n.id, "kind": n.kind, "severity": n.severity, "title": n.title, "message": n.message,
             "reference_id": n.reference_id, "is_read": n.is_read, "created_at": iso(n.created_at)}
            for n in q.order_by(Notification.created_at.desc()).limit(100).all()]


@notif_router.post("/read-all")
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.is_read.is_(False)).update({"is_read": True})
    db.commit()
    return {"ok": True}


@notif_router.post("/{nid}/read")
def read_one(nid: int, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    n = db.get(Notification, nid)
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}
