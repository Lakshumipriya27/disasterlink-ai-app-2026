from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Shelter, User
from ..security import require_staff
from ..serializers import shelter_out
from ..services.audit import log
from ..services.geo import nearest_area
from ..services.shelters import match_shelters

router = APIRouter(prefix="/api/shelters", tags=["Shelters"])


@router.get("", summary="Public shelter list (no personal data)")
def list_shelters(db: Session = Depends(get_db)):
    return [shelter_out(s) for s in db.query(Shelter).order_by(Shelter.area, Shelter.name).all()]


class MatchIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    family_size: int = Field(default=1, ge=1, le=50)
    wheelchair: bool = False
    medical: bool = False
    children: bool = False
    elderly: bool = False
    women_safe: bool = False
    needs_food: bool = True
    needs_water: bool = True


@router.post("/match", summary="Recommend shelters for individual requirements (public)")
def match(body: MatchIn, db: Session = Depends(get_db)):
    return match_shelters(db.query(Shelter).all(), **body.model_dump())


class ShelterIn(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    area: str = Field(default="", max_length=64)
    address: str = Field(default="", max_length=255)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    capacity: int = Field(ge=1, le=100000)
    occupancy: int = Field(default=0, ge=0)
    wheelchair_accessible: bool = False
    accessibility_verified: bool = False
    accessible_toilets: bool = False
    drinking_water: bool = True
    food_available: bool = True
    medical_support: bool = False
    family_rooms: bool = False
    women_safe_space: bool = False
    contact: str = Field(default="", max_length=128)


@router.post("")
def create(body: ShelterIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    if body.occupancy > body.capacity:
        raise HTTPException(400, "Occupancy cannot exceed capacity")
    s = Shelter(**body.model_dump())
    s.area = s.area or nearest_area(s.lat, s.lng)
    db.add(s)
    log(db, user.username, "shelter_created", "shelter", s.id)
    db.commit()
    return shelter_out(s)


class ShelterUpdate(BaseModel):
    occupancy: int | None = Field(default=None, ge=0)
    capacity: int | None = Field(default=None, ge=1)
    status: str | None = Field(default=None, pattern="^(open|full|closed)$")
    wheelchair_accessible: bool | None = None
    accessibility_verified: bool | None = None
    accessible_toilets: bool | None = None
    drinking_water: bool | None = None
    food_available: bool | None = None
    medical_support: bool | None = None
    family_rooms: bool | None = None
    women_safe_space: bool | None = None


@router.patch("/{shelter_id}")
def update(shelter_id: str, body: ShelterUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    s = db.get(Shelter, shelter_id)
    if not s:
        raise HTTPException(404, "Shelter not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    if s.occupancy > s.capacity:
        raise HTTPException(400, "Occupancy cannot exceed capacity")
    if body.status is None and s.status != "closed":
        s.status = "full" if s.remaining == 0 else "open"
    log(db, user.username, "shelter_updated", "shelter", s.id, str(body.model_dump(exclude_none=True)))
    db.commit()
    return shelter_out(s)
