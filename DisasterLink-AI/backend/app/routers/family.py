from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FamilyMatchSuggestion, MissingPersonReport, User
from ..ratelimit import public_rate_limit
from ..security import require_staff
from ..serializers import iso, missing_out
from ..services.audit import log
from ..services.family import refresh_suggestions
from ..services.geo import nearest_area

router = APIRouter(prefix="/api/family", tags=["Family Reconnection"])


class ReportIn(BaseModel):
    report_type: Literal["missing", "found"] = "missing"
    person_name: str = Field(min_length=2, max_length=128)
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str = Field(default="", max_length=16)
    description: str = Field(default="", max_length=2000)
    family_reference: str = Field(default="", max_length=128)
    last_known_location: str = Field(default="", max_length=255)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    last_seen_at: datetime | None = None
    reporter_contact: str = Field(min_length=3, max_length=128)
    consent_to_share: bool = False


@router.post("/reports", summary="Submit a missing/found person report (public). Reports are never public.",
             dependencies=[Depends(public_rate_limit)])
def submit(body: ReportIn, db: Session = Depends(get_db)):
    r = MissingPersonReport(**body.model_dump())
    r.last_seen_at = body.last_seen_at.replace(tzinfo=None) if body.last_seen_at else None
    r.area = nearest_area(r.lat, r.lng) if r.lat is not None else ""
    db.add(r)
    db.flush()
    n = refresh_suggestions(db)
    log(db, "public", "family_report", "missing_person", r.id, f"{r.report_type}; {n} new suggestions")
    db.commit()
    return {"id": r.id, "status": r.status,
            "message": "Report received. Only authorised coordinators can see it. You will be contacted only after "
                       "a coordinator verifies a possible match and both parties consent."}


@router.get("/reports/{report_id}/status", summary="Public status check (no details disclosed)")
def status(report_id: str, db: Session = Depends(get_db)):
    r = db.get(MissingPersonReport, report_id.strip().upper())
    if not r:
        raise HTTPException(404, "Report not found")
    return {"id": r.id, "status": r.status, "created_at": iso(r.created_at)}


def _revealed_ids(db) -> set[str]:
    ids = set()
    for s in db.query(FamilyMatchSuggestion).filter(FamilyMatchSuggestion.status == "verified",
                                                    FamilyMatchSuggestion.consent_confirmed.is_(True)).all():
        ids |= {s.missing_report_id, s.found_report_id}
    return ids


@router.get("/reports")
def list_reports(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    revealed = _revealed_ids(db)
    return [missing_out(r, r.id in revealed)
            for r in db.query(MissingPersonReport).order_by(MissingPersonReport.created_at.desc()).all()]


@router.get("/suggestions")
def suggestions(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    revealed = _revealed_ids(db)
    out = []
    for s in db.query(FamilyMatchSuggestion).order_by(FamilyMatchSuggestion.score.desc()).all():
        out.append({"id": s.id, "score": s.score, "explanation": s.explanation, "status": s.status,
                    "consent_confirmed": s.consent_confirmed, "verified_by": s.verified_by,
                    "created_at": iso(s.created_at),
                    "missing": missing_out(s.missing_report, s.missing_report_id in revealed),
                    "found": missing_out(s.found_report, s.found_report_id in revealed)})
    return out


@router.post("/refresh", summary="Re-run similarity matching")
def refresh(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    n = refresh_suggestions(db)
    db.commit()
    return {"new_suggestions": n}


class VerifyIn(BaseModel):
    decision: Literal["verified", "rejected"]
    consent_confirmed: bool = False
    note: str = Field(default="", max_length=500)


@router.post("/suggestions/{sid}/verify",
             summary="Human verification. Contact details are revealed only if verified AND consent confirmed.")
def verify(sid: str, body: VerifyIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    s = db.get(FamilyMatchSuggestion, sid)
    if not s:
        raise HTTPException(404, "Suggestion not found")
    if body.decision == "verified" and not body.consent_confirmed:
        raise HTTPException(400, "Confirm that both parties consented before verifying a match")
    s.status = body.decision
    s.consent_confirmed = body.consent_confirmed if body.decision == "verified" else False
    s.verified_by = user.username
    if body.decision == "verified":
        s.missing_report.status = "reunited"
        s.found_report.status = "reunited"
    log(db, user.username, f"family_match_{body.decision}", "family_match", s.id, body.note)
    db.commit()
    return {"id": s.id, "status": s.status, "consent_confirmed": s.consent_confirmed}
