"""Convert ORM objects to JSON-ready dicts, applying role-based privacy rules."""
from .models import (EmergencyRequest, MediaAttachment, MissingPersonReport, Resource, ResourceMatch, Shelter,
                     SOSAlert, Volunteer, VolunteerAssignment, VulnerablePerson)
from .security import STAFF


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def mask_phone(p: str) -> str:
    if not p:
        return ""
    return "•" * max(0, len(p) - 3) + p[-3:]


def request_out(r: EmergencyRequest, role: str = "public", full: bool = True) -> dict:
    staff = role in STAFF
    d = {
        "id": r.id, "client_id": r.client_id, "source": r.source, "description": r.description,
        "category": r.category, "categories": r.categories or [], "keywords": r.keywords or [],
        "classification_confidence": r.classification_confidence,
        "classification_explanation": r.classification_explanation or [],
        "classification_engine": r.classification_engine, "people_affected": r.people_affected,
        "quantity_needed": r.quantity_needed, "location_name": r.location_name, "area": r.area,
        "lat": r.lat, "lng": r.lng, "has_elderly": r.has_elderly, "has_children": r.has_children,
        "has_disabled": r.has_disabled, "has_medical_condition": r.has_medical_condition,
        "has_pregnant": r.has_pregnant, "urgency": r.urgency, "urgency_recommended": r.urgency_recommended,
        "urgency_score": r.urgency_score, "urgency_factors": r.urgency_factors or [],
        "urgency_override": r.urgency_override, "override_reason": r.override_reason,
        "overridden_by": r.overridden_by, "status": r.status, "verification_status": r.verification_status,
        "verified_by": r.verified_by, "duplicate_of": r.duplicate_of, "duplicate_score": r.duplicate_score,
        "assigned_volunteer_id": r.assigned_volunteer_id, "synced_from_offline": r.synced_from_offline,
        "offline_created_at": iso(r.offline_created_at), "is_simulated": r.is_simulated,
        "created_at": iso(r.created_at), "updated_at": iso(r.updated_at),
        "requester_name": r.requester_name if staff else (r.requester_name[:1] + "." if r.requester_name else ""),
        "contact_phone": r.contact_phone if staff else mask_phone(r.contact_phone),
    }
    return d


def tracking_out(r: EmergencyRequest) -> dict:
    """Minimal public view: no personal data."""
    return {"id": r.id, "category": r.category, "status": r.status, "verification_status": r.verification_status,
            "urgency": r.urgency, "area": r.area, "created_at": iso(r.created_at), "updated_at": iso(r.updated_at),
            "synced_from_offline": r.synced_from_offline}


def media_out(m: MediaAttachment) -> dict:
    return {"id": m.id, "owner_type": m.owner_type, "owner_id": m.owner_id, "kind": m.kind,
            "mime_type": m.mime_type, "size_bytes": m.size_bytes, "duration_s": m.duration_s,
            "created_at": iso(m.created_at), "url": f"/api/media/{m.id}/file"}


def sos_out(s: SOSAlert, media: list | None = None, role: str = "public") -> dict:
    return {"id": s.id, "client_id": s.client_id, "category": s.category, "categories": s.categories or [],
            "message": s.message, "silent": s.silent, "lat": s.lat, "lng": s.lng, "accuracy_m": s.accuracy_m,
            "location_status": s.location_status, "area": s.area, "accessibility_needs": s.accessibility_needs or [],
            "verification_status": s.verification_status, "assistance_status": s.assistance_status,
            "coordinator_notes": s.coordinator_notes if role in STAFF else "", "request_id": s.request_id,
            "synced_from_offline": s.synced_from_offline, "device_created_at": iso(s.device_created_at),
            "is_simulated": s.is_simulated, "created_at": iso(s.created_at), "updated_at": iso(s.updated_at),
            "media": [media_out(m) for m in (media or [])]}


def vulnerable_out(v: VulnerablePerson, role: str) -> dict:
    staff = role in STAFF
    last = v.welfare_checks[0] if v.welfare_checks else None
    return {"id": v.id, "display_name": v.display_name if staff else "Registered person",
            "contact_phone": v.contact_phone if staff else mask_phone(v.contact_phone),
            "address_hint": v.address_hint if staff else "", "area": v.area, "lat": v.lat, "lng": v.lng,
            "categories": v.categories or [], "assistance_requirements": v.assistance_requirements,
            "accessibility_requirements": v.accessibility_requirements, "household_size": v.household_size,
            "emergency_contact": v.emergency_contact if staff else "", "consent_status": v.consent_status,
            "consent_date": iso(v.consent_date), "last_verified": iso(v.last_verified),
            "assistance_arrangement": v.assistance_arrangement, "is_simulated": v.is_simulated,
            "last_check": {"attempted_at": iso(last.attempted_at), "outcome": last.outcome, "notes": last.notes,
                           "performed_by": last.performed_by, "method": last.method} if last else None,
            "welfare_checks": [{"id": w.id, "attempted_at": iso(w.attempted_at), "outcome": w.outcome,
                                "notes": w.notes, "performed_by": w.performed_by, "method": w.method}
                               for w in v.welfare_checks] if staff else []}


def resource_out(r: Resource) -> dict:
    return {"id": r.id, "name": r.name, "category": r.category, "quantity": r.quantity,
            "reserved_quantity": r.reserved_quantity, "available_quantity": r.available_quantity, "unit": r.unit,
            "expiry_date": iso(r.expiry_date), "location_name": r.location_name, "area": r.area, "lat": r.lat,
            "lng": r.lng, "organization_id": r.organization_id,
            "organization": r.organization.name if r.organization else None, "availability": r.availability,
            "is_simulated": r.is_simulated, "updated_at": iso(r.updated_at)}


def match_out(m: ResourceMatch) -> dict:
    return {"id": m.id, "request_id": m.request_id, "resource_id": m.resource_id, "quantity": m.quantity,
            "distance_km": m.distance_km, "score": m.score, "explanation": m.explanation or [],
            "destination": m.destination, "status": m.status, "decided_by": m.decided_by,
            "decision_note": m.decision_note, "created_at": iso(m.created_at), "updated_at": iso(m.updated_at),
            "request": {"id": m.request.id, "category": m.request.category, "urgency": m.request.urgency,
                        "area": m.request.area, "quantity_needed": m.request.quantity_needed,
                        "status": m.request.status, "description": (m.request.description or "")[:140]},
            "resource": {"id": m.resource.id, "name": m.resource.name, "category": m.resource.category,
                         "available_quantity": m.resource.available_quantity, "unit": m.resource.unit,
                         "area": m.resource.area, "location_name": m.resource.location_name,
                         "organization": m.resource.organization.name if m.resource.organization else None}}


def shelter_out(s: Shelter) -> dict:
    return {"id": s.id, "name": s.name, "area": s.area, "address": s.address, "lat": s.lat, "lng": s.lng,
            "capacity": s.capacity, "occupancy": s.occupancy, "remaining": s.remaining,
            "wheelchair_accessible": s.wheelchair_accessible, "accessibility_verified": s.accessibility_verified,
            "accessible_toilets": s.accessible_toilets, "drinking_water": s.drinking_water,
            "food_available": s.food_available, "medical_support": s.medical_support, "family_rooms": s.family_rooms,
            "women_safe_space": s.women_safe_space, "contact": s.contact, "status": s.status,
            "is_simulated": s.is_simulated, "updated_at": iso(s.updated_at)}


def volunteer_out(v: Volunteer, role: str) -> dict:
    staff = role in STAFF
    return {"id": v.id, "name": v.name, "phone": v.phone if staff else mask_phone(v.phone),
            "organization_id": v.organization_id, "organization": v.organization.name if v.organization else None,
            "assistance_types": v.assistance_types or [], "service_area": v.service_area, "lat": v.lat, "lng": v.lng,
            "skills": v.skills, "has_vehicle": v.has_vehicle, "availability": v.availability,
            "approval_status": v.approval_status, "is_simulated": v.is_simulated, "created_at": iso(v.created_at)}


def assignment_out(a: VolunteerAssignment) -> dict:
    return {"id": a.id, "volunteer_id": a.volunteer_id, "volunteer_name": a.volunteer.name if a.volunteer else "",
            "task_type": a.task_type, "reference_id": a.reference_id, "description": a.description,
            "status": a.status, "assigned_by": a.assigned_by, "created_at": iso(a.created_at),
            "updated_at": iso(a.updated_at)}


def missing_out(m: MissingPersonReport, reveal_contact: bool = False) -> dict:
    return {"id": m.id, "report_type": m.report_type, "person_name": m.person_name, "age": m.age,
            "gender": m.gender, "description": m.description, "family_reference": m.family_reference,
            "last_known_location": m.last_known_location, "area": m.area, "lat": m.lat, "lng": m.lng,
            "last_seen_at": iso(m.last_seen_at), "has_photo": bool(m.photo_path),
            "reporter_contact": m.reporter_contact if reveal_contact else "Hidden until verified match + consent",
            "consent_to_share": m.consent_to_share, "status": m.status, "is_simulated": m.is_simulated,
            "created_at": iso(m.created_at)}
