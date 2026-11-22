from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EmergencyRequest, MediaAttachment, SOSAlert, SynchronizationRecord, User
from ..ratelimit import public_rate_limit
from ..security import require_operations, require_staff
from ..serializers import iso, sos_out
from ..services.audit import log, notify
from ..services.geo import nearest_area
from ..services.pipeline import process_new_request

router = APIRouter(prefix="/api/sos", tags=["Emergency SOS"])

SOS_CATEGORIES = {"rescue", "medicine", "water", "food", "shelter", "transport", "clothing", "other"}
CATEGORY_TEXT = {"rescue": "Needs rescue", "medicine": "Needs medical help / medicine", "water": "Needs drinking water",
                 "food": "Needs food", "shelter": "Needs shelter", "transport": "Needs transport / evacuation",
                 "clothing": "Needs clothing / blankets", "other": "Needs help"}


class SOSIn(BaseModel):
    client_id: str | None = Field(default=None, max_length=64)
    category: str = Field(default="rescue", max_length=32)
    categories: list[str] = Field(default_factory=list, max_length=8)
    message: str = Field(default="", max_length=2000)
    silent: bool = False
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0)
    location_status: Literal["captured", "denied", "unavailable", "timeout"] = "unavailable"
    accessibility_needs: list[str] = Field(default_factory=list, max_length=10)
    device_created_at: datetime | None = None


def _description(s: SOSAlert) -> str:
    parts = ["One-touch SOS alert."]
    parts += [CATEGORY_TEXT.get(c, c) + "." for c in (s.categories or [s.category])]
    if s.accessibility_needs:
        parts.append("Accessibility needs: " + ", ".join(s.accessibility_needs) + ".")
    if s.message:
        parts.append(s.message)
    return " ".join(parts)


def create_sos(db: Session, body: SOSIn, offline: bool = False) -> tuple[SOSAlert, bool]:
    if body.client_id:
        ex = db.query(SOSAlert).filter(SOSAlert.client_id == body.client_id).first()
        if ex:
            return ex, False
    cat = body.category if body.category in SOS_CATEGORIES else "other"
    cats = [c for c in dict.fromkeys([cat] + body.categories) if c in SOS_CATEGORIES]
    s = SOSAlert(client_id=body.client_id, category=cat, categories=cats, message=body.message.strip(),
                 silent=body.silent, lat=body.lat, lng=body.lng, accuracy_m=body.accuracy_m,
                 location_status=body.location_status if body.lat is not None else
                 (body.location_status if body.location_status != "captured" else "unavailable"),
                 area=nearest_area(body.lat, body.lng) if body.lat is not None else "",
                 accessibility_needs=body.accessibility_needs, synced_from_offline=offline,
                 device_created_at=body.device_created_at.replace(tzinfo=None) if body.device_created_at else None)
    db.add(s)
    db.flush()
    req = EmergencyRequest(client_id=f"sos:{body.client_id}" if body.client_id else None, source="sos",
                           description=_description(s), lat=s.lat, lng=s.lng, area=s.area,
                           has_disabled=bool(s.accessibility_needs), synced_from_offline=offline,
                           location_name="GPS location" if s.lat is not None else "Location not shared",
                           offline_created_at=s.device_created_at if offline else None)
    db.add(req)
    db.flush()
    process_new_request(db, req, hint_category=cat, is_sos=True, use_external=False)
    s.request_id = req.id
    if body.client_id:
        db.add(SynchronizationRecord(client_id=body.client_id, entity_type="sos", entity_id=s.id,
                                     device_created_at=s.device_created_at))
    notify(db, "sos", f"SOS alert {s.id}" + (f" in {s.area}" if s.area else ""),
           f"{', '.join(cats)}. Location: {s.location_status}." + (" Silent SOS." if s.silent else ""),
           "critical", s.id)
    log(db, "public", "sos_created", "sos", s.id, f"offline={offline}")
    return s, True


@router.post("", summary="Submit a one-touch SOS (public; idempotent via client_id)",
             dependencies=[Depends(public_rate_limit)])
def submit_sos(body: SOSIn, db: Session = Depends(get_db)):
    try:
        s, created = create_sos(db, body)
        db.commit()
    except IntegrityError:
        db.rollback()
        s = db.query(SOSAlert).filter(SOSAlert.client_id == body.client_id).first()
        if not s:
            raise
        created = False
    return {"id": s.id, "request_id": s.request_id, "created": created, "received_at": iso(s.created_at),
            "location_status": s.location_status, "area": s.area, "categories": s.categories}


class SOSDetailsIn(BaseModel):
    client_id: str = Field(min_length=8, max_length=64)
    categories: list[str] = Field(default_factory=list, max_length=8)
    message: str | None = Field(default=None, max_length=2000)
    accessibility_needs: list[str] | None = None


@router.patch("/{sos_id}/details", summary="Sender adds categories/details after sending (proved by client_id)")
def add_details(sos_id: str, body: SOSDetailsIn, db: Session = Depends(get_db)):
    s = db.get(SOSAlert, sos_id)
    if not s or s.client_id != body.client_id:
        raise HTTPException(404, "SOS not found")
    cats = [c for c in dict.fromkeys((s.categories or []) + body.categories) if c in SOS_CATEGORIES]
    s.categories = cats
    if body.message is not None:
        s.message = body.message
    if body.accessibility_needs is not None:
        s.accessibility_needs = body.accessibility_needs
    if s.request_id:
        req = db.get(EmergencyRequest, s.request_id)
        if req:
            req.description = _description(s)
            req.has_disabled = bool(s.accessibility_needs)
            process_new_request(db, req, hint_category=cats[0] if cats else s.category, is_sos=True,
                                use_external=False)
    db.commit()
    return {"id": s.id, "categories": s.categories}


@router.get("/track/{sos_id}", summary="Public SOS status (no personal data)")
def track(sos_id: str, db: Session = Depends(get_db)):
    s = db.get(SOSAlert, sos_id.strip().upper())
    if not s:
        raise HTTPException(404, "SOS not found on the server. If it was sent offline it may not have synced yet.")
    return {"id": s.id, "assistance_status": s.assistance_status, "verification_status": s.verification_status,
            "created_at": iso(s.created_at), "updated_at": iso(s.updated_at)}


def _media_for(db, ids):
    rows = db.query(MediaAttachment).filter(MediaAttachment.owner_type == "sos",
                                            MediaAttachment.owner_id.in_(ids)).all() if ids else []
    out = {}
    for m in rows:
        out.setdefault(m.owner_id, []).append(m)
    return out


@router.get("", summary="List SOS alerts (operations roles)")
def list_sos(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    q = db.query(SOSAlert)
    if status:
        q = q.filter(SOSAlert.assistance_status == status)
    rows = q.order_by(SOSAlert.created_at.desc()).all()
    media = _media_for(db, [r.id for r in rows])
    return [sos_out(r, media.get(r.id, []), user.role_name) for r in rows]


@router.get("/{sos_id}")
def get_sos(sos_id: str, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    s = db.get(SOSAlert, sos_id)
    if not s:
        raise HTTPException(404, "SOS not found")
    return sos_out(s, _media_for(db, [s.id]).get(s.id, []), user.role_name)


class SOSUpdate(BaseModel):
    verification_status: Literal["unverified", "verified", "false_alarm"] | None = None
    assistance_status: Literal["awaiting_response", "acknowledged", "team_dispatched", "assisted", "closed"] | None = None
    coordinator_notes: str | None = Field(default=None, max_length=2000)


@router.patch("/{sos_id}", summary="Coordinator updates SOS verification / assistance status")
def update_sos(sos_id: str, body: SOSUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    s = db.get(SOSAlert, sos_id)
    if not s:
        raise HTTPException(404, "SOS not found")
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(s, k, v)
    req = db.get(EmergencyRequest, s.request_id) if s.request_id else None
    if req:
        if body.verification_status == "verified":
            req.verification_status, req.verified_by = "verified", user.username
            if req.status == "pending":
                req.status = "verified"
        elif body.verification_status == "false_alarm":
            req.verification_status, req.status = "rejected", "rejected"
        if body.assistance_status in ("team_dispatched", "acknowledged") and req.status in ("pending", "verified"):
            req.status = "in_progress"
        if body.assistance_status in ("assisted", "closed") and req.status != "rejected":
            req.status = "fulfilled"
    log(db, user.username, "sos_updated", "sos", s.id, str(changes))
    db.commit()
    return sos_out(s, _media_for(db, [s.id]).get(s.id, []), user.role_name)
