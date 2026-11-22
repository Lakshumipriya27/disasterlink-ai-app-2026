"""Unreported need detection.

Flags areas where the simulated impact and the registered vulnerable population suggest more need
than the requests received so far. Outputs are ESTIMATES that recommend welfare checks - they never
create confirmed emergency cases. Absence of reports is never treated as absence of need.
"""
from datetime import timedelta

from sqlalchemy.orm import Session

from ..models import (DisasterScenario, EmergencyRequest, SOSAlert, VulnerablePerson, utcnow)
from .matching import demand_supply

ASSUMED_REPORTING_RATE = 0.002    # expected requests per affected person (~1 request per 500 people)
ASSUMED_NEED_SHARE = 0.25         # share of affected population likely to need help at severity 1.0


def detect(db: Session) -> dict:
    scenario = db.query(DisasterScenario).filter(DisasterScenario.is_active.is_(True)).first()
    if not scenario:
        return {"scenario": None, "areas": [], "assumptions": {}}
    now = utcnow()
    reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status != "duplicate").all()
    sos = db.query(SOSAlert).all()
    vps = db.query(VulnerablePerson).filter(VulnerablePerson.consent_status == "given").all()
    shortages = demand_supply(db)
    out = []
    for z in scenario.impact_zones:
        area = z["area"]
        a_reqs = [r for r in reqs if r.area == area]
        verified = [r for r in a_reqs if r.verification_status == "verified"]
        unverified = [r for r in a_reqs if r.verification_status == "unverified"]
        a_sos = [s for s in sos if s.area == area]
        a_vp = [v for v in vps if v.area == area]
        checked_recent = []
        last_check = None
        for v in a_vp:
            if v.welfare_checks:
                t = v.welfare_checks[0].attempted_at
                last_check = t if not last_check or t > last_check else last_check
                if now - t <= timedelta(hours=48):
                    checked_recent.append(v)
        unchecked = len(a_vp) - len(checked_recent)
        pop = int(z.get("estimated_affected_population", 0))
        sev = float(z.get("severity", 0.5))
        expected = max(1.0, pop * ASSUMED_REPORTING_RATE * sev)
        received = len(verified) + len(unverified) + len(a_sos)
        ratio = received / expected
        reported_people = sum(r.people_affected for r in a_reqs)
        est_need = int(pop * sev * ASSUMED_NEED_SHARE)
        est_unreported = max(0, est_need - reported_people)
        area_short = [s for s in shortages if s["area"] == area and s["status"] in ("shortage", "critical_shortage")]

        score = (1 - min(1.0, ratio)) * 40 + sev * 25 + min(1.0, unchecked / 4) * 20 + min(1.0, len(area_short) / 2) * 15
        score = round(score, 1)
        level = "high" if score >= 65 else "moderate" if score >= 45 else "low"
        recs = []
        if unchecked:
            recs.append(f"Schedule welfare checks for {unchecked} registered vulnerable "
                        f"{'person' if unchecked == 1 else 'people'} not checked in the last 48 h.")
        if ratio < 0.5:
            recs.append("Request volume is far below what the impact estimate suggests - send a field "
                        "assessment team or community volunteers to verify conditions.")
        for s in area_short[:2]:
            recs.append(f"Address {s['category']} shortage (gap {s['gap']} units).")
        if not recs:
            recs.append("No immediate action suggested; continue monitoring.")
        out.append({
            "area": area, "lat": z.get("lat"), "lng": z.get("lng"), "severity": sev,
            "impact_note": z.get("note", ""), "estimated_affected_population": pop,
            "confirmed_requests": len(verified), "unverified_reports": len(unverified), "sos_alerts": len(a_sos),
            "expected_requests": round(expected, 1), "reporting_ratio": round(ratio, 2),
            "reported_people": reported_people, "estimated_need_people": est_need,
            "estimated_unreported_people": est_unreported, "registered_vulnerable": len(a_vp),
            "vulnerable_unchecked_48h": unchecked, "last_welfare_check": last_check.isoformat() if last_check else None,
            "shortages": [s["category"] for s in area_short], "underserved_score": score, "level": level,
            "recommendations": recs,
        })
    out.sort(key=lambda x: -x["underserved_score"])
    return {
        "scenario": {"id": scenario.id, "name": scenario.name, "type": scenario.disaster_type},
        "areas": out,
        "assumptions": {
            "reporting_rate": ASSUMED_REPORTING_RATE, "need_share_at_full_severity": ASSUMED_NEED_SHARE,
            "note": "Estimates from SIMULATED impact data. Not an official disaster warning. "
                    "An area with few or no reports may still have affected people.",
        },
    }
