from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DisasterScenario, User, VulnerablePerson, WelfareCheck, utcnow
from ..ratelimit import public_rate_limit
from ..security import require_staff
from ..serializers import vulnerable_out
from ..services.audit import log
from ..services.geo import nearest_area

router = APIRouter(prefix="/api/vulnerable", tags=["Vulnerable People Registry"])

VP_CATEGORIES = ["elderly_alone", "mobility", "medical", "visual", "hearing", "accessible_transport", "special_shelter"]


class VPIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=128)
    contact_phone: str = Field(default="", max_length=32)
    address_hint: str = Field(default="", max_length=255)
    area: str = Field(default="", max_length=64)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    categories: list[str] = Field(default_factory=list)
    assistance_requirements: str = Field(default="", max_length=2000)
    accessibility_requirements: str = Field(default="", max_length=2000)
    household_size: int = Field(default=1, ge=1, le=50)
    emergency_contact: str = Field(default="", max_length=128)
    consent: bool = Field(description="Explicit consent to store and use this information for relief coordination")


def _apply(v: VulnerablePerson, body: VPIn):
    for f in ("display_name", "contact_phone", "address_hint", "lat", "lng", "assistance_requirements",
              "accessibility_requirements", "household_size", "emergency_contact"):
        setattr(v, f, getattr(body, f))
    v.categories = [c for c in body.categories if c in VP_CATEGORIES]
    v.area = body.area or (nearest_area(body.lat, body.lng) if body.lat is not None else "")


@router.post("/register", summary="Consent-based self-registration (public)", dependencies=[Depends(public_rate_limit)])
def self_register(body: VPIn, db: Session = Depends(get_db)):
    if not body.consent:
        raise HTTPException(400, "Consent is required to register")
    v = VulnerablePerson(consent_status="given", consent_date=utcnow())
    _apply(v, body)
    db.add(v)
    log(db, "public", "vulnerable_registered", "vulnerable", v.id)
    db.commit()
    return {"id": v.id, "message": "Registered. Your information is visible only to authorised coordinators. "
                                   "Registration does not trigger an emergency response - use SOS if you need help now."}


@router.get("", summary="Registry (coordinators/admin only)")
def list_vp(area: str | None = None, category: str | None = None, include_withdrawn: bool = False,
            db: Session = Depends(get_db), user: User = Depends(require_staff)):
    q = db.query(VulnerablePerson)
    if area: q = q.filter(VulnerablePerson.area == area)
    if not include_withdrawn: q = q.filter(VulnerablePerson.consent_status == "given")
    rows = q.order_by(VulnerablePerson.area, VulnerablePerson.display_name).all()
    if category:
        rows = [r for r in rows if category in (r.categories or [])]
    return [vulnerable_out(r, user.role_name) for r in rows]


@router.get("/in-affected-areas", summary="Registered people located in currently affected zones")
def in_affected(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    sc = db.query(DisasterScenario).filter(DisasterScenario.is_active.is_(True)).first()
    zones = {z["area"]: z for z in (sc.impact_zones if sc else [])}
    rows = db.query(VulnerablePerson).filter(VulnerablePerson.consent_status == "given").all()
    out = []
    for r in rows:
        if r.area in zones:
            d = vulnerable_out(r, user.role_name)
            d["zone_severity"] = zones[r.area].get("severity")
            out.append(d)
    out.sort(key=lambda x: (-(x["zone_severity"] or 0), x["last_check"]["attempted_at"] if x["last_check"] else ""))
    return {"note": "Registration indicates a person MAY need extra support; it does not mean they are in danger.",
            "people": out}


@router.post("", summary="Coordinator registers a person (with recorded consent)")
def create_vp(body: VPIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    if not body.consent:
        raise HTTPException(400, "Consent must be recorded")
    v = VulnerablePerson(consent_status="given", consent_date=utcnow(), last_verified=utcnow())
    _apply(v, body)
    db.add(v)
    log(db, user.username, "vulnerable_created", "vulnerable", v.id)
    db.commit()
    return vulnerable_out(v, user.role_name)


class VPUpdate(BaseModel):
    assistance_arrangement: str | None = Field(default=None, max_length=2000)
    assistance_requirements: str | None = Field(default=None, max_length=2000)
    accessibility_requirements: str | None = Field(default=None, max_length=2000)
    mark_verified: bool = False


@router.patch("/{vp_id}")
def update_vp(vp_id: str, body: VPUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    v = db.get(VulnerablePerson, vp_id)
    if not v:
        raise HTTPException(404, "Not found")
    for k, val in body.model_dump(exclude_none=True, exclude={"mark_verified"}).items():
        setattr(v, k, val)
    if body.mark_verified:
        v.last_verified = utcnow()
    log(db, user.username, "vulnerable_updated", "vulnerable", v.id)
    db.commit()
    return vulnerable_out(v, user.role_name)


class WelfareIn(BaseModel):
    method: Literal["phone", "visit", "neighbour", "volunteer"] = "phone"
    outcome: Literal["safe", "needs_assistance", "no_response", "relocated"]
    notes: str = Field(default="", max_length=1000)


@router.post("/{vp_id}/welfare-checks", summary="Record a welfare-check attempt")
def add_check(vp_id: str, body: WelfareIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    v = db.get(VulnerablePerson, vp_id)
    if not v:
        raise HTTPException(404, "Not found")
    db.add(WelfareCheck(person_id=v.id, method=body.method, outcome=body.outcome, notes=body.notes,
                        performed_by=user.username))
    if body.outcome in ("safe", "needs_assistance", "relocated"):
        v.last_verified = utcnow()
    log(db, user.username, "welfare_check", "vulnerable", v.id, body.outcome)
    db.commit()
    db.refresh(v)
    return vulnerable_out(v, user.role_name)


@router.post("/{vp_id}/withdraw-consent", summary="Withdraw consent: personal details are erased")
def withdraw(vp_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    v = db.get(VulnerablePerson, vp_id)
    if not v:
        raise HTTPException(404, "Not found")
    v.consent_status = "withdrawn"
    v.display_name, v.contact_phone, v.address_hint, v.emergency_contact = "Withdrawn", "", "", ""
    v.assistance_requirements = v.accessibility_requirements = ""
    v.lat = v.lng = None
    log(db, user.username, "consent_withdrawn", "vulnerable", v.id)
    db.commit()
    return {"ok": True}
