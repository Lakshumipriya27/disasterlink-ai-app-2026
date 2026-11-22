"""Intelligent shelter matching: hard requirements filter, then weighted scoring with reasons."""
from ..models import Shelter
from .geo import haversine_km


def match_shelters(shelters: list[Shelter], lat: float, lng: float, family_size: int = 1, wheelchair: bool = False,
                   medical: bool = False, children: bool = False, elderly: bool = False, women_safe: bool = False,
                   needs_food: bool = True, needs_water: bool = True, limit: int = 5) -> dict:
    ranked, excluded = [], []
    for s in shelters:
        d = haversine_km(lat, lng, s.lat, s.lng)
        base = {"id": s.id, "name": s.name, "area": s.area, "lat": s.lat, "lng": s.lng, "distance_km": round(d, 2), "remaining": s.remaining,
                "capacity": s.capacity, "contact": s.contact}
        if s.status == "closed":
            excluded.append({**base, "reason": "Shelter is closed."}); continue
        if s.remaining < family_size:
            excluded.append({**base, "reason": f"Only {s.remaining} places left; {family_size} needed."}); continue
        if wheelchair and not s.wheelchair_accessible:
            excluded.append({**base, "reason": "Not wheelchair accessible."}); continue
        if wheelchair and not s.accessibility_verified:
            excluded.append({**base, "reason": "Wheelchair access claimed but not verified."}); continue

        reasons, warnings = [], []
        score = 40 * max(0.0, 1 - d / 25)
        reasons.append(f"{d:.1f} km away")
        score += 15 * min(1.0, s.remaining / max(1, s.capacity) * 2)
        reasons.append(f"{s.remaining} of {s.capacity} places free")
        if wheelchair:
            score += 10; reasons.append("Verified wheelchair access")
            if s.accessible_toilets:
                score += 5; reasons.append("Accessible toilets")
            else:
                warnings.append("No accessible toilets")
        for need, flag, label, pts in [
            (medical or elderly, s.medical_support, "Basic medical support", 10),
            (needs_water, s.drinking_water, "Drinking water", 5),
            (needs_food, s.food_available, "Food available", 5),
            (children or family_size >= 3, s.family_rooms, "Family rooms", 6),
            (women_safe, s.women_safe_space, "Women-safe space", 6),
        ]:
            if need:
                if flag:
                    score += pts; reasons.append(label)
                else:
                    warnings.append(f"No {label.lower()}")
        ranked.append({**base, "score": round(score, 1), "reasons": reasons, "warnings": warnings,
                       "facilities": {"wheelchair": s.wheelchair_accessible and s.accessibility_verified,
                                      "accessible_toilets": s.accessible_toilets, "water": s.drinking_water,
                                      "food": s.food_available, "medical": s.medical_support,
                                      "family_rooms": s.family_rooms, "women_safe": s.women_safe_space}})
    ranked.sort(key=lambda x: -x["score"])
    nearest = min((haversine_km(lat, lng, s.lat, s.lng), s) for s in shelters)[1] if shelters else None
    note = None
    if nearest and ranked and ranked[0]["id"] != nearest.id:
        ex = next((e for e in excluded if e["id"] == nearest.id), None)
        note = (f"The nearest shelter ({nearest.name}) was " +
                (f"excluded: {ex['reason']}" if ex else "ranked lower because it meets fewer of the stated needs."))
    return {"recommendations": ranked[:limit], "excluded": excluded, "note": note}
