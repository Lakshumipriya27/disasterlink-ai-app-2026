from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Organization, User, Volunteer, VolunteerAssignment
from ..ratelimit import public_rate_limit
from ..security import require_operations, require_staff
from ..serializers import assignment_out, volunteer_out
from ..services.audit import log
from ..services.geo import AREAS

router = APIRouter(prefix="/api/volunteers", tags=["Volunteer Network"])

ASSIST_TYPES = ["food_distribution", "water_distribution", "transportation", "shelter_assistance", "welfare_checks",
                "general_relief"]


class VolunteerIn(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    phone: str = Field(default="", max_length=32)
    organization_id: str | None = None
    organization_name: str = Field(default="", max_length=128, description="New organisation name (optional)")
    assistance_types: list[str] = Field(min_length=1)
    service_area: str = Field(min_length=2, max_length=64)
    skills: str = Field(default="", max_length=1000)
    has_vehicle: bool = False


@router.post("/register", summary="Volunteer / organisation registration (public; pending coordinator approval)",
             dependencies=[Depends(public_rate_limit)])
def register(body: VolunteerIn, db: Session = Depends(get_db)):
    types = [t for t in body.assistance_types if t in ASSIST_TYPES]
    if not types:
        raise HTTPException(400, "Select at least one valid assistance type")
    org_id = body.organization_id if body.organization_id and db.get(Organization, body.organization_id) else None
    if not org_id and body.organization_name.strip():
        org = Organization(name=body.organization_name.strip(), org_type="Community group",
                           service_areas=[body.service_area])
        db.add(org)
        db.flush()
        org_id = org.id
    coords = AREAS.get(body.service_area)
    v = Volunteer(name=body.name.strip(), phone=body.phone.strip(), organization_id=org_id, assistance_types=types,
                  service_area=body.service_area, lat=coords[0] if coords else None,
                  lng=coords[1] if coords else None, skills=body.skills, has_vehicle=body.has_vehicle,
                  approval_status="pending")
    db.add(v)
    log(db, "public", "volunteer_registered", "volunteer", v.id)
    db.commit()
    return {"id": v.id, "approval_status": v.approval_status,
            "message": "Thank you. A coordinator will review and approve your registration."}


@router.get("/organizations/public", summary="Organisation names for the registration form")
def public_orgs(db: Session = Depends(get_db)):
    return [{"id": o.id, "name": o.name} for o in db.query(Organization).order_by(Organization.name).all()]


@router.get("")
def list_volunteers(area: str | None = None, availability: str | None = None, db: Session = Depends(get_db),
                    user: User = Depends(require_operations)):
    q = db.query(Volunteer)
    if area: q = q.filter(Volunteer.service_area == area)
    if availability: q = q.filter(Volunteer.availability == availability)
    return [volunteer_out(v, user.role_name) for v in q.order_by(Volunteer.created_at.desc()).all()]


class VolunteerUpdate(BaseModel):
    approval_status: Literal["pending", "approved", "rejected"] | None = None
    availability: Literal["available", "busy", "offline"] | None = None


@router.patch("/{vol_id}")
def update(vol_id: str, body: VolunteerUpdate, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    v = db.get(Volunteer, vol_id)
    if not v:
        raise HTTPException(404, "Volunteer not found")
    if user.role_name == "volunteer":
        if user.volunteer_id != v.id or body.approval_status is not None:
            raise HTTPException(403, "Volunteers can only change their own availability")
    for k, val in body.model_dump(exclude_none=True).items():
        setattr(v, k, val)
    log(db, user.username, "volunteer_updated", "volunteer", v.id, str(body.model_dump(exclude_none=True)))
    db.commit()
    return volunteer_out(v, user.role_name)


@router.get("/assignments", summary="Assignments (volunteers see only their own)")
def assignments(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    q = db.query(VolunteerAssignment)
    if user.role_name == "volunteer":
        q = q.filter(VolunteerAssignment.volunteer_id == (user.volunteer_id or "-"))
    return [assignment_out(a) for a in q.order_by(VolunteerAssignment.created_at.desc()).all()]


class AssignmentIn(BaseModel):
    volunteer_id: str
    task_type: Literal["request", "welfare_check", "match_delivery", "general"] = "general"
    reference_id: str | None = None
    description: str = Field(min_length=3, max_length=1000)


@router.post("/assignments", summary="Coordinator-controlled assignment")
def create_assignment(body: AssignmentIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    v = db.get(Volunteer, body.volunteer_id)
    if not v or v.approval_status != "approved":
        raise HTTPException(400, "Volunteer not found or not approved")
    a = VolunteerAssignment(**body.model_dump(), assigned_by=user.username)
    db.add(a)
    v.availability = "busy"
    log(db, user.username, "assignment_created", "volunteer", v.id, body.description[:100])
    db.commit()
    db.refresh(a)
    return assignment_out(a)


class AssignmentUpdate(BaseModel):
    status: Literal["assigned", "accepted", "completed", "cancelled"]


@router.patch("/assignments/{asg_id}")
def update_assignment(asg_id: str, body: AssignmentUpdate, db: Session = Depends(get_db),
                      user: User = Depends(require_operations)):
    a = db.get(VolunteerAssignment, asg_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    if user.role_name == "volunteer" and a.volunteer_id != user.volunteer_id:
        raise HTTPException(403, "Not your assignment")
    a.status = body.status
    if body.status in ("completed", "cancelled"):
        still = db.query(VolunteerAssignment).filter(VolunteerAssignment.volunteer_id == a.volunteer_id,
                                                     VolunteerAssignment.id != a.id,
                                                     VolunteerAssignment.status.in_(("assigned", "accepted"))).count()
        if not still and a.volunteer:
            a.volunteer.availability = "available"
    log(db, user.username, "assignment_status", "assignment", a.id, body.status)
    db.commit()
    return assignment_out(a)
