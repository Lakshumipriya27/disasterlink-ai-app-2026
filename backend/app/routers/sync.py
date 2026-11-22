"""Offline synchronisation. Each queued item carries a client-generated UUID (client_id).
The server stores every client_id in synchronization_records, so re-sending the same item
(e.g. after a dropped response) returns the existing record instead of creating a duplicate."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EmergencyRequest, SOSAlert, SynchronizationRecord, User
from ..ratelimit import public_rate_limit
from ..security import require_staff
from ..serializers import iso
from ..services.audit import log
from .requests import RequestIn, create_request
from .sos import SOSIn, create_sos

router = APIRouter(prefix="/api/sync", tags=["Offline Synchronisation"])


class SyncItem(BaseModel):
    client_id: str = Field(min_length=8, max_length=64)
    type: Literal["request", "sos"]
    payload: dict
    device_created_at: datetime | None = None


class SyncBatch(BaseModel):
    items: list[SyncItem] = Field(max_length=200)
    device_id: str | None = Field(default=None, max_length=64)


@router.post("/batch", summary="Upload queued offline items (idempotent)", dependencies=[Depends(public_rate_limit)])
def sync_batch(body: SyncBatch, db: Session = Depends(get_db)):
    results = []
    for item in body.items:
        rec = db.query(SynchronizationRecord).filter(SynchronizationRecord.client_id == item.client_id).first()
        if rec:
            rec.attempts += 1
            db.commit()
            results.append({"client_id": item.client_id, "status": "already_synced", "entity_type": rec.entity_type,
                            "entity_id": rec.entity_id})
            continue
        try:
            payload = {**item.payload, "client_id": item.client_id,
                       "device_created_at": item.device_created_at or item.payload.get("device_created_at")}
            if item.type == "request":
                obj, _, created = create_request(db, RequestIn(**payload), "offline_sync", offline=True,
                                                 actor="offline-sync")
                eid = obj.id
            else:
                obj, created = create_sos(db, SOSIn(**payload), offline=True)
                eid = obj.id
            db.commit()
            results.append({"client_id": item.client_id, "status": "created" if created else "already_synced",
                            "entity_type": item.type, "entity_id": eid,
                            "request_id": getattr(obj, "request_id", None)})
        except ValidationError as e:
            db.rollback()
            results.append({"client_id": item.client_id, "status": "rejected",
                            "error": "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors())})
        except Exception as e:  # noqa: BLE001 - report per-item failure, keep going
            db.rollback()
            results.append({"client_id": item.client_id, "status": "failed", "error": str(e)[:300]})
    created = sum(1 for r in results if r["status"] == "created")
    if created:
        log(db, "offline-sync", "sync_batch", "sync", "", f"{created} created, device={body.device_id}")
        db.commit()
    return {"results": results, "server_time": iso(datetime.now(timezone.utc).replace(tzinfo=None))}


@router.get("/check/{client_id}", summary="Has this client item reached the server?")
def check(client_id: str, db: Session = Depends(get_db)):
    rec = db.query(SynchronizationRecord).filter(SynchronizationRecord.client_id == client_id).first()
    return {"synced": bool(rec), "entity_id": rec.entity_id if rec else None,
            "entity_type": rec.entity_type if rec else None}


@router.get("/records", summary="Synchronisation log (staff)")
def records(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    rows = db.query(SynchronizationRecord).order_by(SynchronizationRecord.received_at.desc()).limit(300).all()
    offline_reqs = db.query(EmergencyRequest).filter(EmergencyRequest.synced_from_offline.is_(True)).count()
    offline_sos = db.query(SOSAlert).filter(SOSAlert.synced_from_offline.is_(True)).count()
    return {"offline_requests": offline_reqs, "offline_sos": offline_sos,
            "duplicate_upload_attempts_blocked": sum(max(0, r.attempts - 1) for r in rows),
            "records": [{"client_id": r.client_id, "entity_type": r.entity_type, "entity_id": r.entity_id,
                         "device_created_at": iso(r.device_created_at), "received_at": iso(r.received_at),
                         "attempts": r.attempts} for r in rows]}
