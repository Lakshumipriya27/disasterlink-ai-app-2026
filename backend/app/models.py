"""SQLAlchemy ORM models. Portable between SQLite (dev) and PostgreSQL."""
import secrets
from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def gen_id(prefix: str) -> str:
    """Short, unique, human-readable ID such as REQ-7F3A2C91."""
    return f"{prefix}-{secrets.token_hex(4).upper()}"


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    role: Mapped[Role] = relationship(lazy="joined")
    volunteer_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else "public"


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("ORG"))
    name: Mapped[str] = mapped_column(String(128))
    org_type: Mapped[str] = mapped_column(String(64), default="NGO")
    contact: Mapped[str] = mapped_column(String(128), default="")
    service_areas: Mapped[list] = mapped_column(JSON, default=list)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("REQ"))
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    source: Mapped[str] = mapped_column(String(24), default="web")  # web | sos | offline_sync | coordinator
    requester_name: Mapped[str] = mapped_column(String(128), default="")
    contact_phone: Mapped[str] = mapped_column(String(32), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32), index=True, default="other")
    categories: Mapped[list] = mapped_column(JSON, default=list)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    classification_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    classification_explanation: Mapped[list] = mapped_column(JSON, default=list)
    classification_engine: Mapped[str] = mapped_column(String(32), default="rule-based")
    people_affected: Mapped[int] = mapped_column(Integer, default=1)
    quantity_needed: Mapped[int] = mapped_column(Integer, default=1)
    location_name: Mapped[str] = mapped_column(String(255), default="")
    area: Mapped[str] = mapped_column(String(64), index=True, default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_elderly: Mapped[bool] = mapped_column(Boolean, default=False)
    has_children: Mapped[bool] = mapped_column(Boolean, default=False)
    has_disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    has_medical_condition: Mapped[bool] = mapped_column(Boolean, default=False)
    has_pregnant: Mapped[bool] = mapped_column(Boolean, default=False)
    urgency_recommended: Mapped[str] = mapped_column(String(16), default="medium")
    urgency_score: Mapped[float] = mapped_column(Float, default=0)
    urgency_factors: Mapped[list] = mapped_column(JSON, default=list)
    urgency_override: Mapped[str | None] = mapped_column(String(16), nullable=True)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    overridden_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(24), index=True, default="pending")
    # pending | verified | in_progress | fulfilled | rejected | duplicate
    verification_status: Mapped[str] = mapped_column(String(24), default="unverified")  # unverified|verified|rejected
    verified_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    duplicate_of: Mapped[str | None] = mapped_column(String(32), nullable=True)
    duplicate_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    assigned_volunteer_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    synced_from_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    offline_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    @property
    def urgency(self) -> str:
        return self.urgency_override or self.urgency_recommended


class SOSAlert(Base):
    __tablename__ = "sos_alerts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("SOS"))
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    category: Mapped[str] = mapped_column(String(32), default="rescue")
    categories: Mapped[list] = mapped_column(JSON, default=list)
    message: Mapped[str] = mapped_column(Text, default="")
    silent: Mapped[bool] = mapped_column(Boolean, default=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_status: Mapped[str] = mapped_column(String(32), default="unavailable")  # captured|denied|unavailable
    area: Mapped[str] = mapped_column(String(64), default="")
    accessibility_needs: Mapped[list] = mapped_column(JSON, default=list)
    verification_status: Mapped[str] = mapped_column(String(24), default="unverified")
    assistance_status: Mapped[str] = mapped_column(String(24), default="awaiting_response")
    # awaiting_response | acknowledged | team_dispatched | assisted | closed
    coordinator_notes: Mapped[str] = mapped_column(Text, default="")
    request_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    synced_from_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    device_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class MediaAttachment(Base):
    __tablename__ = "media_attachments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("MED"))
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    owner_type: Mapped[str] = mapped_column(String(24))  # sos | request | missing_person
    owner_id: Mapped[str] = mapped_column(String(32), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # video | audio | image
    mime_type: Mapped[str] = mapped_column(String(64))
    file_name: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(512))
    size_bytes: Mapped[int] = mapped_column(Integer)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VulnerablePerson(Base):
    __tablename__ = "vulnerable_people"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("VP"))
    display_name: Mapped[str] = mapped_column(String(128))
    contact_phone: Mapped[str] = mapped_column(String(32), default="")
    address_hint: Mapped[str] = mapped_column(String(255), default="")
    area: Mapped[str] = mapped_column(String(64), index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    categories: Mapped[list] = mapped_column(JSON, default=list)
    assistance_requirements: Mapped[str] = mapped_column(Text, default="")
    accessibility_requirements: Mapped[str] = mapped_column(Text, default="")
    household_size: Mapped[int] = mapped_column(Integer, default=1)
    emergency_contact: Mapped[str] = mapped_column(String(128), default="")
    consent_status: Mapped[str] = mapped_column(String(16), default="given")  # given | withdrawn
    consent_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_verified: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assistance_arrangement: Mapped[str] = mapped_column(Text, default="")
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    welfare_checks: Mapped[list["WelfareCheck"]] = relationship(
        back_populates="person", cascade="all, delete-orphan", order_by="WelfareCheck.attempted_at.desc()")


class WelfareCheck(Base):
    __tablename__ = "welfare_checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[str] = mapped_column(ForeignKey("vulnerable_people.id"), index=True)
    person: Mapped[VulnerablePerson] = relationship(back_populates="welfare_checks")
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    method: Mapped[str] = mapped_column(String(32), default="phone")
    outcome: Mapped[str] = mapped_column(String(32))  # safe | needs_assistance | no_response | relocated
    notes: Mapped[str] = mapped_column(Text, default="")
    performed_by: Mapped[str] = mapped_column(String(64), default="")


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("RES"))
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(32), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(32), default="units")
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    location_name: Mapped[str] = mapped_column(String(255), default="")
    area: Mapped[str] = mapped_column(String(64), index=True, default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    organization: Mapped[Organization | None] = relationship(lazy="joined")
    availability: Mapped[str] = mapped_column(String(16), default="available")  # available|limited|depleted
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)


class ResourceMatch(Base):
    __tablename__ = "resource_matches"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("MATCH"))
    request_id: Mapped[str] = mapped_column(ForeignKey("emergency_requests.id"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("resources.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    distance_km: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    explanation: Mapped[list] = mapped_column(JSON, default=list)
    destination: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(24), default="awaiting_approval")
    # suggested | awaiting_approval | approved | dispatched | fulfilled | rejected
    decided_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    request: Mapped[EmergencyRequest] = relationship(lazy="joined")
    resource: Mapped[Resource] = relationship(lazy="joined")


class Shelter(Base):
    __tablename__ = "shelters"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("SHL"))
    name: Mapped[str] = mapped_column(String(128))
    area: Mapped[str] = mapped_column(String(64), index=True)
    address: Mapped[str] = mapped_column(String(255), default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer)
    occupancy: Mapped[int] = mapped_column(Integer, default=0)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    accessibility_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    accessible_toilets: Mapped[bool] = mapped_column(Boolean, default=False)
    drinking_water: Mapped[bool] = mapped_column(Boolean, default=True)
    food_available: Mapped[bool] = mapped_column(Boolean, default=True)
    medical_support: Mapped[bool] = mapped_column(Boolean, default=False)
    family_rooms: Mapped[bool] = mapped_column(Boolean, default=False)
    women_safe_space: Mapped[bool] = mapped_column(Boolean, default=False)
    contact: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | full | closed
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    @property
    def remaining(self) -> int:
        return max(0, self.capacity - self.occupancy)


class Volunteer(Base):
    __tablename__ = "volunteers"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("VOL"))
    name: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str] = mapped_column(String(32), default="")
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    organization: Mapped[Organization | None] = relationship(lazy="joined")
    assistance_types: Mapped[list] = mapped_column(JSON, default=list)
    service_area: Mapped[str] = mapped_column(String(64), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[str] = mapped_column(Text, default="")
    has_vehicle: Mapped[bool] = mapped_column(Boolean, default=False)
    availability: Mapped[str] = mapped_column(String(16), default="available")  # available|busy|offline
    approval_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|approved|rejected
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VolunteerAssignment(Base):
    __tablename__ = "volunteer_assignments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("ASG"))
    volunteer_id: Mapped[str] = mapped_column(ForeignKey("volunteers.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(32))  # request | welfare_check | match_delivery | general
    reference_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="assigned")  # assigned|accepted|completed|cancelled
    assigned_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    volunteer: Mapped[Volunteer] = relationship(lazy="joined")


class MissingPersonReport(Base):
    __tablename__ = "missing_person_reports"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("MPR"))
    report_type: Mapped[str] = mapped_column(String(16), default="missing")  # missing | found
    person_name: Mapped[str] = mapped_column(String(128))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(16), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    family_reference: Mapped[str] = mapped_column(String(128), default="")
    last_known_location: Mapped[str] = mapped_column(String(255), default="")
    area: Mapped[str] = mapped_column(String(64), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reporter_contact: Mapped[str] = mapped_column(String(128), default="")  # restricted
    consent_to_share: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | reunited | closed
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FamilyMatchSuggestion(Base):
    __tablename__ = "family_match_suggestions"
    __table_args__ = (UniqueConstraint("missing_report_id", "found_report_id", name="uq_family_pair"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("FMS"))
    missing_report_id: Mapped[str] = mapped_column(ForeignKey("missing_person_reports.id"), index=True)
    found_report_id: Mapped[str] = mapped_column(ForeignKey("missing_person_reports.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    explanation: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="suggested")  # suggested | verified | rejected
    consent_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    missing_report: Mapped[MissingPersonReport] = relationship(foreign_keys=[missing_report_id], lazy="joined")
    found_report: Mapped[MissingPersonReport] = relationship(foreign_keys=[found_report_id], lazy="joined")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))  # shortage | expiry | sos | duplicate | welfare | sync | system
    severity: Mapped[str] = mapped_column(String(16), default="info")  # info | warning | critical
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, default="")
    reference_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class SynchronizationRecord(Base):
    __tablename__ = "synchronization_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[str] = mapped_column(String(32))
    device_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    attempts: Mapped[int] = mapped_column(Integer, default=1)


class DisasterScenario(Base):
    __tablename__ = "disaster_scenarios"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: gen_id("SCN"))
    name: Mapped[str] = mapped_column(String(128))
    disaster_type: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    impact_zones: Mapped[list] = mapped_column(JSON, default=list)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor: Mapped[str] = mapped_column(String(64), default="system")
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(32), default="")
    entity_id: Mapped[str] = mapped_column(String(32), default="")
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
