from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..ai import duplicates
from ..database import get_db
from ..models import EmergencyRequest, ResourceMatch, SynchronizationRecord, User, Volunteer, VolunteerAssignment
from ..ratelimit import public_rate_limit
from ..security import get_optional_user, require_operations, require_staff
from ..serializers import match_out, request_out, tracking_out
from ..services.audit import log
from ..services.pipeline import compute_urgency, process_new_request, request_to_dict

router = APIRouter(prefix="/api/requests", tags=["Emergency Requests"])

Category = Literal["food", "water", "medicine", "shelter", "transport", "clothing", "rescue", "other"]
Level = Literal["critical", "high", "medium", "low"]


class RequestIn(BaseModel):
    client_id: str | None = Field(default=None, max_length=64, description="Client-generated UUID for idempotency")
    requester_name: str = Field(default="", max_length=128)
    contact_phone: str = Field(default="", max_length=32)
    description: str = Field(min_length=3, max_length=4000)
    category_hint: Category | None = None
    people_affected: int = Field(default=1, ge=1, le=10000)
    quantity_needed: int | None = Field(default=None, ge=1, le=100000)
    location_name: str = Field(default="", max_length=255)
    area: str = Field(default="", max_length=64)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    has_elderly: bool = False
    has_children: bool = False
    has_disabled: bool = False
    has_medical_condition: bool = False
    has_pregnant: bool = False
    device_created_at: datetime | None = None


def create_request(db: Session, body: RequestIn, source: str = "web", offline: bool = False,
                   actor: str = "public") -> tuple[EmergencyRequest, dict | None, bool]:
    """Idempotent creation. Returns (request, analysis, created_new)."""
    if body.client_id:
        existing = db.query(EmergencyRequest).filter(EmergencyRequest.client_id == body.client_id).first()
        if existing:
            return existing, None, False
    req = EmergencyRequest(
        client_id=body.client_id, source=source, requester_name=body.requester_name.strip(),
        contact_phone=body.contact_phone.strip(), description=body.description.strip(),
        people_affected=body.people_affected, quantity_needed=body.quantity_needed or 0,
        location_name=body.location_name.strip(), area=body.area.strip(), lat=body.lat, lng=body.lng,
        has_elderly=body.has_elderly, has_children=body.has_children, has_disabled=body.has_disabled,
        has_medical_condition=body.has_medical_condition, has_pregnant=body.has_pregnant,
        synced_from_offline=offline,
        offline_created_at=body.device_created_at.replace(tzinfo=None) if (offline and body.device_created_at) else None,
    )
    db.add(req)
    db.flush()
    analysis = process_new_request(db, req, body.category_hint)
    if body.client_id:
        db.add(SynchronizationRecord(client_id=body.client_id, entity_type="request", entity_id=req.id,
                                     device_created_at=req.offline_created_at))
    log(db, actor, "request_created", "request", req.id, f"source={source} offline={offline}")
    return req, analysis, True


@router.post("", summary="Submit an emergency request (public; idempotent via client_id)",
             dependencies=[Depends(public_rate_limit)])
def submit(body: RequestIn, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    try:
        req, analysis, created = create_request(db, body, "web", actor=user.username if user else "public")
        db.commit()
    except IntegrityError:
        db.rollback()
        req = db.query(EmergencyRequest).filter(EmergencyRequest.client_id == body.client_id).first()
        if not req:
            raise
        created, analysis = False, None
    out = tracking_out(req)
    out.update({"created": created, "duplicate_submission": not created, "category_label": req.category,
                "classification_explanation": req.classification_explanation, "keywords": req.keywords,
                "urgency_factors": req.urgency_factors, "urgency_score": req.urgency_score})
    return out


@router.get("/track/{request_id}", summary="Public request tracking (no personal data)")
def track(request_id: str, db: Session = Depends(get_db)):
    req = db.get(EmergencyRequest, request_id.strip().upper())
    if not req:
        raise HTTPException(404, "No request found with this ID. If you submitted it offline, it may not have "
                                 "synchronised yet.")
    return tracking_out(req)


@router.get("", summary="List requests with filters (operations roles)")
def list_requests(category: str | None = None, area: str | None = None, urgency: str | None = None,
                  status: str | None = None, verification: str | None = None, source: str | None = None,
                  q: str | None = None, limit: int = Query(500, le=2000),
                  db: Session = Depends(get_db), user: User = Depends(require_operations)):
    query = db.query(EmergencyRequest)
    if category: query = query.filter(EmergencyRequest.category == category)
    if area: query = query.filter(EmergencyRequest.area == area)
    if status: query = query.filter(EmergencyRequest.status == status)
    if verification: query = query.filter(EmergencyRequest.verification_status == verification)
    if source: query = query.filter(EmergencyRequest.source == source)
    if q:
        like = f"%{q}%"
        query = query.filter((EmergencyRequest.description.ilike(like)) | (EmergencyRequest.id.ilike(like)) |
                             (EmergencyRequest.location_name.ilike(like)))
    rows = query.order_by(EmergencyRequest.created_at.desc()).limit(limit).all()
    if urgency:
        rows = [r for r in rows if r.urgency == urgency]
    return [request_out(r, user.role_name) for r in rows]


def _get(db, rid) -> EmergencyRequest:
    req = db.get(EmergencyRequest, rid)
    if not req:
        raise HTTPException(404, "Request not found")
    return req


@router.get("/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    req = _get(db, request_id)
    others = db.query(EmergencyRequest).filter(EmergencyRequest.id != req.id,
                                               EmergencyRequest.status != "duplicate").all()
    dups = duplicates.find_duplicates(request_to_dict(req), [request_to_dict(o) for o in others], threshold=0.5)
    matches = db.query(ResourceMatch).filter(ResourceMatch.request_id == req.id).all()
    return {**request_out(req, user.role_name), "possible_duplicates": dups,
            "matches": [match_out(m) for m in matches]}


class VerifyIn(BaseModel):
    decision: Literal["verified", "rejected"]
    note: str = Field(default="", max_length=500)


@router.post("/{request_id}/verify")
def verify(request_id: str, body: VerifyIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    req.verification_status = body.decision
    req.verified_by = user.username
    if body.decision == "verified" and req.status == "pending":
        req.status = "verified"
    if body.decision == "rejected":
        req.status = "rejected"
    log(db, user.username, f"request_{body.decision}", "request", req.id, body.note)
    db.commit()
    return request_out(req, user.role_name)


class OverrideIn(BaseModel):
    level: Level
    reason: str = Field(min_length=5, max_length=500)


@router.post("/{request_id}/override-urgency", summary="Coordinator override of the AI urgency (reason recorded)")
def override(request_id: str, body: OverrideIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    prev = req.urgency
    req.urgency_override = body.level
    req.override_reason = body.reason
    req.overridden_by = user.username
    log(db, user.username, "urgency_override", "request", req.id, f"{prev} -> {body.level}: {body.reason}")
    db.commit()
    return request_out(req, user.role_name)


@router.post("/{request_id}/clear-override")
def clear_override(request_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    req.urgency_override = None
    req.override_reason = None
    req.overridden_by = None
    log(db, user.username, "urgency_override_cleared", "request", req.id)
    db.commit()
    return request_out(req, user.role_name)


@router.post("/{request_id}/recompute-urgency")
def recompute(request_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    u = compute_urgency(db, req, is_sos=req.source == "sos")
    req.urgency_recommended, req.urgency_score, req.urgency_factors = u["level"], u["score"], u["factors"]
    db.commit()
    return request_out(req, user.role_name)


class StatusIn(BaseModel):
    status: Literal["pending", "verified", "in_progress", "fulfilled", "rejected"]
    note: str = Field(default="", max_length=500)


@router.patch("/{request_id}/status")
def update_status(request_id: str, body: StatusIn, db: Session = Depends(get_db),
                  user: User = Depends(require_operations)):
    req = _get(db, request_id)
    if user.role_name == "volunteer":
        if req.assigned_volunteer_id != user.volunteer_id or body.status not in ("in_progress", "fulfilled"):
            raise HTTPException(403, "Volunteers can only mark their own assigned requests in progress or fulfilled.")
    if body.status in ("verified", "in_progress", "fulfilled") and req.verification_status == "unverified" \
            and user.role_name != "volunteer":
        req.verification_status = "verified"
        req.verified_by = user.username
    req.status = body.status
    log(db, user.username, "request_status", "request", req.id, f"-> {body.status}. {body.note}")
    db.commit()
    return request_out(req, user.role_name)


class DuplicateIn(BaseModel):
    duplicate_of: str


@router.post("/{request_id}/mark-duplicate")
def mark_duplicate(request_id: str, body: DuplicateIn, db: Session = Depends(get_db),
                   user: User = Depends(require_staff)):
    req = _get(db, request_id)
    orig = _get(db, body.duplicate_of)
    if orig.id == req.id:
        raise HTTPException(400, "A request cannot duplicate itself")
    req.status = "duplicate"
    req.duplicate_of = orig.id
    orig.people_affected = max(orig.people_affected, req.people_affected)
    log(db, user.username, "marked_duplicate", "request", req.id, f"duplicate of {orig.id}")
    db.commit()
    return request_out(req, user.role_name)


@router.post("/{request_id}/not-duplicate")
def not_duplicate(request_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    req.duplicate_of = None
    req.duplicate_score = None
    if req.status == "duplicate":
        req.status = "pending"
    log(db, user.username, "duplicate_dismissed", "request", req.id)
    db.commit()
    return request_out(req, user.role_name)


class AssignIn(BaseModel):
    volunteer_id: str
    note: str = Field(default="", max_length=500)


@router.post("/{request_id}/assign")
def assign(request_id: str, body: AssignIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    req = _get(db, request_id)
    vol = db.get(Volunteer, body.volunteer_id)
    if not vol or vol.approval_status != "approved":
        raise HTTPException(400, "Volunteer not found or not approved")
    req.assigned_volunteer_id = vol.id
    if req.status in ("pending", "verified"):
        req.status = "in_progress"
    db.add(VolunteerAssignment(volunteer_id=vol.id, task_type="request", reference_id=req.id,
                               description=body.note or f"Assist with {req.category} request in {req.area}",
                               assigned_by=user.username))
    vol.availability = "busy"
    log(db, user.username, "volunteer_assigned", "request", req.id, vol.id)
    db.commit()
    return request_out(req, user.role_name)
