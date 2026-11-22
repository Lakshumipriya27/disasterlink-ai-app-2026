from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai import external
from ..config import APP_VERSION, DATABASE_URL, MAX_UPLOAD_MB
from ..database import get_db
from ..models import ActivityLog, DisasterScenario, Role, User
from ..security import hash_password, require_admin, require_staff
from ..serializers import iso
from ..services.audit import log
from .auth import user_out

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    db_kind = "SQLite" if DATABASE_URL.startswith("sqlite") else DATABASE_URL.split(":")[0]
    return {"version": APP_VERSION, "database": db_kind, "max_upload_mb": MAX_UPLOAD_MB,
            "ai": external.status(), "users": [user_out(u) for u in db.query(User).order_by(User.id).all()]}


@router.post("/reset-demo", summary="Delete ALL data and re-seed the simulated Chennai flood scenario")
def reset_demo(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    from ..seed import reset_and_seed
    db.close()
    counts = reset_and_seed()
    return {"ok": True, "counts": counts}


@router.get("/activity")
def activity(limit: int = 200, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    return [{"id": a.id, "actor": a.actor, "action": a.action, "entity_type": a.entity_type,
             "entity_id": a.entity_id, "details": a.details, "created_at": iso(a.created_at)}
            for a in db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(min(limit, 1000)).all()]


class UserIn(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    full_name: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "coordinator", "volunteer", "public"]
    volunteer_id: str | None = None


@router.post("/users")
def create_user(body: UserIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    uname = body.username.lower()
    if db.query(User).filter(User.username == uname).first():
        raise HTTPException(409, "Username already exists")
    role = db.query(Role).filter(Role.name == body.role).one()
    u = User(username=uname, full_name=body.full_name, hashed_password=hash_password(body.password), role_id=role.id,
             volunteer_id=body.volunteer_id)
    db.add(u)
    log(db, user.username, "user_created", "user", uname, body.role)
    db.commit()
    db.refresh(u)
    return user_out(u)


class UserUpdate(BaseModel):
    role: Literal["admin", "coordinator", "volunteer", "public"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == user.id and (body.is_active is False or (body.role and body.role != "admin")):
        raise HTTPException(400, "You cannot demote or disable your own account")
    if body.role:
        u.role_id = db.query(Role).filter(Role.name == body.role).one().id
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.password:
        u.hashed_password = hash_password(body.password)
    log(db, user.username, "user_updated", "user", u.username)
    db.commit()
    db.refresh(u)
    return user_out(u)


@router.get("/scenario")
def scenario(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    s = db.query(DisasterScenario).filter(DisasterScenario.is_active.is_(True)).first()
    if not s:
        return None
    return {"id": s.id, "name": s.name, "type": s.disaster_type, "description": s.description,
            "impact_zones": s.impact_zones, "is_simulated": s.is_simulated, "started_at": iso(s.started_at)}


class ZoneUpdate(BaseModel):
    area: str
    severity: float = Field(ge=0, le=1)


@router.patch("/scenario/zone", summary="Adjust simulated severity of an impact zone")
def update_zone(body: ZoneUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    s = db.query(DisasterScenario).filter(DisasterScenario.is_active.is_(True)).first()
    if not s:
        raise HTTPException(404, "No active scenario")
    zones = [dict(z) for z in s.impact_zones]
    for z in zones:
        if z["area"] == body.area:
            z["severity"] = body.severity
    s.impact_zones = zones
    log(db, user.username, "scenario_zone_updated", "scenario", s.id, f"{body.area}={body.severity}")
    db.commit()
    return {"ok": True}
