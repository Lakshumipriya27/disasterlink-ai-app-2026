"""Inventory intelligence: expiry alerts, excess detection and redistribution recommendations."""
from sqlalchemy.orm import Session

from ..models import Resource, utcnow
from .geo import AREAS, haversine_km
from .matching import demand_supply


def inventory_insights(db: Session, expiry_days: int = 7) -> dict:
    now = utcnow()
    expiry = []
    for r in db.query(Resource).all():
        if r.expiry_date and r.quantity > 0:
            days = (r.expiry_date - now).days
            if days <= expiry_days:
                expiry.append({"id": r.id, "name": r.name, "category": r.category, "quantity": r.quantity,
                               "unit": r.unit, "area": r.area, "expiry_date": r.expiry_date.isoformat(),
                               "days_left": days, "status": "expired" if days < 0 else "expiring"})
    expiry.sort(key=lambda x: x["days_left"])
    rows = demand_supply(db)
    shortages = [r for r in rows if r["status"] in ("shortage", "critical_shortage")]
    excess = []
    for r in rows:
        spare = r["supply"] - int(r["verified_demand"] * 1.2)
        if spare >= 50 and r["status"] in ("surplus", "no_verified_demand"):
            excess.append({**r, "spare": spare})
    recs = []
    for s in shortages:
        need = s["gap"]
        donors = []
        for e in excess:
            if e["category"] != s["category"] or e["spare"] <= 0:
                continue
            a, b = AREAS.get(e["area"]), AREAS.get(s["area"])
            d = haversine_km(*a, *b) if a and b else None
            donors.append((d if d is not None else 99, e))
        for d, e in sorted(donors, key=lambda x: x[0]):
            if need <= 0:
                break
            qty = min(need, e["spare"])
            e["spare"] -= qty
            need -= qty
            recs.append({"category": s["category"], "from_area": e["area"], "to_area": s["area"], "quantity": qty,
                         "distance_km": round(d, 1) if d != 99 else None,
                         "reason": f"{e['area']} holds surplus {s['category']} with little verified demand; "
                                   f"{s['area']} has a verified gap of {s['gap']}."})
    return {"expiry_alerts": expiry, "shortages": shortages, "excess": excess, "redistribution": recs}
