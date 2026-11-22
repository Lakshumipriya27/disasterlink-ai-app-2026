from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Organization, Resource, User
from ..security import require_operations, require_staff
from ..serializers import resource_out
from ..services.audit import log
from ..services.geo import nearest_area
from ..services.inventory import inventory_insights

router = APIRouter(prefix="/api/resources", tags=["Resources & Inventory"])

ResCategory = Literal["food", "water", "medicine", "shelter", "transport", "clothing"]


class ResourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    category: ResCategory
    quantity: int = Field(ge=0, le=10_000_000)
    unit: str = Field(default="units", max_length=32)
    expiry_date: datetime | None = None
    location_name: str = Field(default="", max_length=255)
    area: str = Field(default="", max_length=64)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    organization_id: str | None = None


def _availability(r: Resource):
    a = r.available_quantity
    r.availability = "depleted" if a <= 0 else "limited" if a < 20 else "available"


@router.get("")
def list_resources(category: str | None = None, area: str | None = None, db: Session = Depends(get_db),
                   user: User = Depends(require_operations)):
    q = db.query(Resource)
    if category: q = q.filter(Resource.category == category)
    if area: q = q.filter(Resource.area == area)
    return [resource_out(r) for r in q.order_by(Resource.category, Resource.area).all()]


@router.get("/insights", summary="Shortages, expiry alerts, excess inventory and redistribution recommendations")
def insights(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    return inventory_insights(db)


@router.get("/organizations")
def organizations(db: Session = Depends(get_db), user: User = Depends(require_operations)):
    return [{"id": o.id, "name": o.name, "org_type": o.org_type, "contact": o.contact,
             "service_areas": o.service_areas, "is_simulated": o.is_simulated}
            for o in db.query(Organization).order_by(Organization.name).all()]


@router.post("")
def create_resource(body: ResourceIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    if body.organization_id and not db.get(Organization, body.organization_id):
        raise HTTPException(400, "Unknown organization")
    r = Resource(**body.model_dump())
    r.expiry_date = body.expiry_date.replace(tzinfo=None) if body.expiry_date else None
    if not r.area and r.lat is not None:
        r.area = nearest_area(r.lat, r.lng)
    _availability(r)
    db.add(r)
    log(db, user.username, "resource_created", "resource", r.id, f"{r.quantity} {r.unit}")
    db.commit()
    return resource_out(r)


class ResourceUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    adjust: int | None = Field(default=None, description="Relative change, e.g. -20")
    expiry_date: datetime | None = None
    location_name: str | None = None


@router.patch("/{res_id}")
def update_resource(res_id: str, body: ResourceUpdate, db: Session = Depends(get_db),
                    user: User = Depends(require_staff)):
    r = db.get(Resource, res_id)
    if not r:
        raise HTTPException(404, "Resource not found")
    if body.quantity is not None:
        r.quantity = body.quantity
    if body.adjust:
        r.quantity = max(0, r.quantity + body.adjust)
    if r.quantity < r.reserved_quantity:
        raise HTTPException(400, f"Quantity cannot be below reserved amount ({r.reserved_quantity})")
    if body.expiry_date is not None:
        r.expiry_date = body.expiry_date.replace(tzinfo=None)
    if body.location_name is not None:
        r.location_name = body.location_name
    _availability(r)
    log(db, user.username, "resource_updated", "resource", r.id, f"qty={r.quantity}")
    db.commit()
    return resource_out(r)


@router.delete("/{res_id}")
def delete_resource(res_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    r = db.get(Resource, res_id)
    if not r:
        raise HTTPException(404, "Resource not found")
    if r.reserved_quantity:
        raise HTTPException(400, "Resource has approved allocations; cannot delete")
    from ..models import ResourceMatch
    if db.query(ResourceMatch).filter(ResourceMatch.resource_id == r.id).count():
        raise HTTPException(400, "Resource is referenced by match history; set quantity to 0 instead")
    db.delete(r)
    log(db, user.username, "resource_deleted", "resource", res_id)
    db.commit()
    return {"ok": True}
