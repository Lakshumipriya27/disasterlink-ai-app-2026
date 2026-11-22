"""End-to-end API tests against a temporary SQLite database seeded with the simulated scenario.

Run from the backend folder:  python -m pytest -q
"""
import os
import tempfile
import uuid

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-0123456789"
os.environ["AI_PROVIDER"] = "none"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402


@pytest.fixture(scope="module")
def client():
    reset_and_seed()
    with TestClient(app) as c:
        yield c


def token(client, user, pw):
    r = client.post("/api/auth/login", json={"username": user, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def coord(client):
    return token(client, "coordinator", "Coord@2026")


@pytest.fixture(scope="module")
def admin(client):
    return token(client, "admin", "Admin@2026")


@pytest.fixture(scope="module")
def vol(client):
    return token(client, "volunteer", "Volunteer@2026")


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_login_rejects_bad_password(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong-pass"}).status_code == 401


def test_role_permissions(client, coord, vol):
    pub = token(client, "public", "Public@2026")
    assert client.get("/api/requests").status_code == 401                       # anonymous
    assert client.get("/api/requests", headers=pub).status_code == 403           # public role
    assert client.get("/api/requests", headers=vol).status_code == 200          # volunteer can read
    assert client.get("/api/vulnerable", headers=vol).status_code == 403         # restricted registry
    assert client.get("/api/vulnerable", headers=coord).status_code == 200
    assert client.post("/api/admin/reset-demo", headers=coord).status_code == 403  # admin only


def test_seed_counts(client, coord):
    reqs = client.get("/api/requests", headers=coord).json()
    assert len(reqs) >= 25 and all(r["is_simulated"] for r in reqs)
    assert len(client.get("/api/resources", headers=coord).json()) >= 20
    assert len(client.get("/api/shelters").json()) >= 5
    assert len(client.get("/api/vulnerable", headers=coord).json()) >= 10


def test_validation_errors(client):
    r = client.post("/api/requests", json={"description": "x"})
    assert r.status_code == 422 and "description" in r.json()["detail"]
    r = client.post("/api/requests", json={"description": "need water", "lat": 200})
    assert r.status_code == 422


def test_classification_and_urgency(client):
    r = client.post("/api/ai/analyze", json={"text": "Family trapped on rooftop, water rising, grandmother unconscious"}).json()
    assert r["classification"]["category"] == "rescue"
    assert r["urgency"]["level"] == "critical"
    assert any(f["factor"] == "Immediate danger indicators" for f in r["urgency"]["factors"])
    r = client.post("/api/ai/analyze", json={"text": "thanni illai, kudineer venum for 20 people"}).json()
    assert r["classification"]["category"] == "water" and r["people_detected"] == 20


def test_submit_is_idempotent_and_detects_duplicates(client, coord):
    cid = str(uuid.uuid4())
    body = {"client_id": cid, "description": "80 people in our street have no drinking water since yesterday, water cans needed",
            "people_affected": 80, "lat": 13.1215, "lng": 80.2885, "contact_phone": "9000000101"}
    a = client.post("/api/requests", json=body).json()
    b = client.post("/api/requests", json=body).json()
    assert a["id"] == b["id"] and a["created"] and b["duplicate_submission"]
    detail = client.get(f"/api/requests/{a['id']}", headers=coord).json()
    assert detail["duplicate_of"] is not None            # similar seeded request REQ-SIM001/002
    assert detail["possible_duplicates"]


def test_offline_sync_batch_idempotent(client, coord):
    items = [{"client_id": str(uuid.uuid4()), "type": "request",
              "payload": {"description": "Need food packets for 12 people near marsh road", "people_affected": 12,
                          "lat": 12.935, "lng": 80.214}, "device_created_at": "2026-11-22T08:00:00Z"},
             {"client_id": str(uuid.uuid4()), "type": "sos",
              "payload": {"category": "rescue", "lat": 12.91, "lng": 80.07, "location_status": "captured"}},
             {"client_id": str(uuid.uuid4()), "type": "request", "payload": {"description": "x"}}]
    r1 = client.post("/api/sync/batch", json={"items": items}).json()["results"]
    assert [r["status"] for r in r1] == ["created", "created", "rejected"]
    r2 = client.post("/api/sync/batch", json={"items": items[:2]}).json()["results"]
    assert [r["status"] for r in r2] == ["already_synced", "already_synced"]
    assert r2[0]["entity_id"] == r1[0]["entity_id"]
    req = client.get(f"/api/requests/{r1[0]['entity_id']}", headers=coord).json()
    assert req["synced_from_offline"] and req["area"] == "Pallikaranai" and req["offline_created_at"]


def test_sos_media_upload_and_access(client, coord):
    cid = str(uuid.uuid4())
    s = client.post("/api/sos", json={"client_id": cid, "category": "rescue", "lat": 12.98, "lng": 80.22,
                                      "location_status": "captured"}).json()
    assert s["created"] and s["area"] == "Velachery"
    files = {"file": ("a.webm", b"\x1aE\xdf\xa3fakewebm", "audio/webm")}
    m = client.post("/api/media/upload", data={"owner_type": "sos", "owner_id": s["id"], "kind": "audio",
                                               "client_id": "m-" + cid}, files=files)
    assert m.status_code == 200 and m.json()["created"]
    again = client.post("/api/media/upload", data={"owner_type": "sos", "owner_id": s["id"], "kind": "audio",
                                                   "client_id": "m-" + cid}, files=files).json()
    assert again["created"] is False
    bad = client.post("/api/media/upload", data={"owner_type": "sos", "owner_id": s["id"], "kind": "video"},
                      files={"file": ("x.exe", b"MZ", "application/x-msdownload")})
    assert bad.status_code == 415
    assert client.get(m.json()["url"]).status_code == 401
    assert client.get(m.json()["url"], headers=coord).status_code == 200
    det = client.patch(f"/api/sos/{s['id']}/details", json={"client_id": cid, "categories": ["medicine"]}).json()
    assert det["categories"] == ["rescue", "medicine"]
    assert client.patch(f"/api/sos/{s['id']}/details", json={"client_id": "wrong-client-id", "categories": []}).status_code == 404


def test_urgency_override_requires_reason(client, coord):
    assert client.post("/api/requests/REQ-SIM008/override-urgency", json={"level": "high", "reason": ""},
                       headers=coord).status_code == 422
    r = client.post("/api/requests/REQ-SIM008/override-urgency", json={"level": "high", "reason": "Infants exposed to cold"},
                    headers=coord).json()
    assert r["urgency"] == "high" and r["overridden_by"] == "coordinator"


def test_matching_workflow_requires_human_approval(client, coord):
    shortages = client.get("/api/matching/shortages", headers=coord).json()
    assert any(s["area"] == "North Chennai" and s["category"] == "water" and s["status"] == "critical_shortage"
               for s in shortages)
    gen = client.post("/api/matching/generate", headers=coord).json()
    assert gen["created"] > 0 and all(m["status"] == "suggested" for m in gen["matches"])
    m = gen["matches"][0]
    res_before = client.get("/api/resources", headers=coord).json()
    avail_before = next(r for r in res_before if r["id"] == m["resource_id"])["available_quantity"]
    # cannot skip approval
    assert client.post(f"/api/matching/{m['id']}/transition", json={"action": "dispatch"}, headers=coord).status_code == 400
    for action, status in [("submit", "awaiting_approval"), ("approve", "approved"), ("dispatch", "dispatched"),
                           ("fulfil", "fulfilled")]:
        r = client.post(f"/api/matching/{m['id']}/transition", json={"action": action}, headers=coord)
        assert r.status_code == 200 and r.json()["status"] == status
    after = next(r for r in client.get("/api/resources", headers=coord).json() if r["id"] == m["resource_id"])
    assert after["available_quantity"] == avail_before - m["quantity"] and after["reserved_quantity"] >= 0


def test_shelter_matching_prefers_verified_accessibility(client):
    r = client.post("/api/shelters/match", json={"lat": 12.9815, "lng": 80.218, "wheelchair": True}).json()
    assert r["recommendations"][0]["id"] == "SHL-SIM03"
    assert any(e["id"] == "SHL-SIM02" and "not verified" in e["reason"] for e in r["excluded"])
    assert r["note"]


def test_unreported_need_detection(client, coord):
    areas = client.get("/api/analytics/impact", headers=coord).json()["areas"]
    top = {a["area"]: a for a in areas}
    # Mudichur has no organic requests and many unchecked vulnerable residents -> flagged; Avadi is not
    assert top["Mudichur"]["level"] in ("high", "moderate") and top["Pallikaranai"]["level"] in ("high", "moderate")
    assert top["Avadi"]["underserved_score"] < top["Mudichur"]["underserved_score"]
    assert "estimated_unreported_people" in top["Mudichur"]


def test_family_disclosure_requires_consent(client, coord):
    sug = client.get("/api/family/suggestions", headers=coord).json()
    assert sug and "Hidden" in sug[0]["missing"]["reporter_contact"]
    sid = sug[0]["id"]
    assert client.post(f"/api/family/suggestions/{sid}/verify", json={"decision": "verified", "consent_confirmed": False},
                       headers=coord).status_code == 400
    assert client.post(f"/api/family/suggestions/{sid}/verify", json={"decision": "verified", "consent_confirmed": True},
                       headers=coord).status_code == 200
    s = next(x for x in client.get("/api/family/suggestions", headers=coord).json() if x["id"] == sid)
    assert "Hidden" not in s["missing"]["reporter_contact"]


def test_vulnerable_registry_consent_and_welfare(client, coord):
    assert client.post("/api/vulnerable/register", json={"display_name": "Test", "area": "Avadi", "consent": False}).status_code == 400
    r = client.post("/api/vulnerable/register", json={"display_name": "Test Person", "area": "Avadi", "consent": True}).json()
    w = client.post(f"/api/vulnerable/{r['id']}/welfare-checks", json={"outcome": "safe"}, headers=coord).json()
    assert w["last_check"]["outcome"] == "safe"
    client.post(f"/api/vulnerable/{r['id']}/withdraw-consent", headers=coord)
    ids = [p["id"] for p in client.get("/api/vulnerable", headers=coord).json()]
    assert r["id"] not in ids


def test_volunteer_cannot_approve_itself(client, vol):
    assert client.patch("/api/volunteers/VOL-SIM08", json={"approval_status": "approved"}, headers=vol).status_code == 403
    assert client.patch("/api/volunteers/VOL-SIM01", json={"availability": "busy"}, headers=vol).status_code == 200


def test_dashboard_reflects_data(client, coord):
    d = client.get("/api/analytics/dashboard", headers=coord).json()
    total = len(client.get("/api/requests", headers=coord).json())
    assert d["stats"]["total_requests"] == total
    f = client.get("/api/analytics/dashboard?area=Velachery&category=medicine", headers=coord).json()
    assert 0 < f["stats"]["total_requests"] < total


def test_reset_demo(client, admin):
    r = client.post("/api/admin/reset-demo", headers=admin)
    assert r.status_code == 200 and r.json()["counts"]["requests"] >= 25
