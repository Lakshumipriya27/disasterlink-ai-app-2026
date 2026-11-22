"""Geospatial helpers: haversine distance and the simulated Chennai area gazetteer."""
import math

# Approximate centroids of Chennai localities used by the SIMULATED scenario.
AREAS = {
    "North Chennai": (13.1210, 80.2880),
    "Tambaram": (12.9249, 80.1000),
    "Velachery": (12.9815, 80.2180),
    "Avadi": (13.1147, 80.1018),
    "Perungudi": (12.9654, 80.2461),
    "Pallikaranai": (12.9349, 80.2137),
    "Mudichur": (12.9120, 80.0700),
}

CHENNAI_CENTER = (13.0400, 80.2000)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    if None in (lat1, lng1, lat2, lng2):
        return float("inf")
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_area(lat, lng, max_km: float = 12.0) -> str:
    if lat is None or lng is None:
        return ""
    best, best_d = "", float("inf")
    for name, (alat, alng) in AREAS.items():
        d = haversine_km(lat, lng, alat, alng)
        if d < best_d:
            best, best_d = name, d
    return best if best_d <= max_km else "Other"


def area_coords(area: str):
    return AREAS.get(area)
