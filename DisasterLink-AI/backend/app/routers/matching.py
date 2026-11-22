from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ResourceMatch, User
from ..security import require_operations, require_staff
from ..serializers import match_out
from ..services.audit import log
from ..services.matching import demand_supply, generate_suggestions

router = APIRouter(prefix="/api/matching", tags=["Smart Resource Matching"])

TRANSITIONS = {
    "submit": ("suggested", "awaiting_approval"),
    "approve": ("awaiting_approval", "approved"),
    "dispatch": ("approved", "dispatched"),
    "fulfil": ("dispatched", "fulfilled"),
}


@router.get("/shortages", summary="Verified demand vs available supply per area and category")
def shortages(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    return demand_supply(db)


@router.post("/generate", summary="Run the matching engine; creates SUGGESTED matches only")
def generate(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    created = generate_suggestions(db, user.username)
    log(db, user.username, "matching_run", "match", "", f"{len(created)} suggestions")
    db.commit()
    return {"created": len(created), "matches": [match_out(m) for m in created]}


@router.get("")
def list_matches(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_operations)):
    q = db.query(ResourceMatch)
    if status:
        q = q.filter(ResourceMatch.status == status)
    return [match_out(m) for m in q.order_by(ResourceMatch.created_at.desc()).all()]


class TransitionIn(BaseModel):
    action: Literal["submit", "approve", "reject", "dispatch", "fulfil"]
    note: str = Field(default="", max_length=500)


@router.post("/{match_id}/transition", summary="Human-in-the-loop workflow: submit -> approve -> dispatch -> fulfil")
def transition(match_id: str, body: TransitionIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    m = db.get(ResourceMatch, match_id)
    if not m:
        raise HTTPException(404, "Match not found")
    res, req = m.resource, m.request
    if body.action == "reject":
        if m.status in ("fulfilled", "rejected", "dispatched"):
            raise HTTPException(400, f"Cannot reject a {m.status} match")
        if m.status == "approved":
            res.reserved_quantity = max(0, res.reserved_quantity - m.quantity)
        m.status = "rejected"
    else:
        frm, to = TRANSITIONS[body.action]
        if m.status != frm:
            raise HTTPException(400, f"Cannot {body.action}: match is '{m.status}', expected '{frm}'")
        if body.action == "approve":
            if res.available_quantity < m.quantity:
                raise HTTPException(409, f"Only {res.available_quantity} {res.unit} still available - "
                                         "re-run matching or reject this suggestion")
            res.reserved_quantity += m.quantity
            if req.status in ("pending", "verified"):
                req.status = "in_progress"
        if body.action == "fulfil":
            res.quantity = max(0, res.quantity - m.quantity)
            res.reserved_quantity = max(0, res.reserved_quantity - m.quantity)
            delivered = sum(x.quantity for x in db.query(ResourceMatch).filter(
                ResourceMatch.request_id == req.id, ResourceMatch.status == "fulfilled").all()) + m.quantity
            if delivered >= req.quantity_needed:
                req.status = "fulfilled"
        m.status = to
    a = res.available_quantity
    res.availability = "depleted" if a <= 0 else "limited" if a < 20 else "available"
    m.decided_by = user.username
    m.decision_note = body.note or m.decision_note
    log(db, user.username, f"match_{body.action}", "match", m.id, body.note)
    db.commit()
    return match_out(m)
