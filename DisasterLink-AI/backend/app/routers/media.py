import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import get_db
from ..models import EmergencyRequest, MediaAttachment, MissingPersonReport, SOSAlert, User
from ..ratelimit import public_rate_limit
from ..security import require_staff
from ..serializers import media_out
from ..services.audit import log

router = APIRouter(prefix="/api/media", tags=["Media Attachments"])

ALLOWED_PREFIX = {"video": "video/", "audio": "audio/", "image": "image/"}
EXT = {"video/webm": ".webm", "video/mp4": ".mp4", "audio/webm": ".weba", "audio/ogg": ".ogg", "audio/mp4": ".m4a",
       "audio/mpeg": ".mp3", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _resolve_owner(db, owner_type, owner_id, owner_client_id):
    model = {"sos": SOSAlert, "request": EmergencyRequest, "missing_person": MissingPersonReport}.get(owner_type)
    if not model:
        raise HTTPException(400, "owner_type must be sos, request or missing_person")
    obj = db.get(model, owner_id) if owner_id else None
    if not obj and owner_client_id and hasattr(model, "client_id"):
        obj = db.query(model).filter(model.client_id == owner_client_id).first()
    if not obj:
        raise HTTPException(404, "Owner record not found on server (sync the record before uploading media)")
    return obj


@router.post("/upload", summary="Upload an attachment (public; idempotent via client_id; size-limited)",
             dependencies=[Depends(public_rate_limit)])
async def upload(file: UploadFile = File(...), owner_type: str = Form(...), owner_id: str | None = Form(None),
                 owner_client_id: str | None = Form(None), kind: str = Form(...),
                 client_id: str | None = Form(None), duration_s: float | None = Form(None),
                 db: Session = Depends(get_db)):
    if kind not in ALLOWED_PREFIX:
        raise HTTPException(400, "kind must be video, audio or image")
    mime = (file.content_type or "").split(";")[0].strip().lower()
    if not mime.startswith(ALLOWED_PREFIX[kind]):
        raise HTTPException(415, f"File type {mime or 'unknown'} not allowed for {kind}")
    if client_id:
        ex = db.query(MediaAttachment).filter(MediaAttachment.client_id == client_id).first()
        if ex:
            return {**media_out(ex), "created": False}
    owner = _resolve_owner(db, owner_type, owner_id, owner_client_id)
    limit = MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit")
    if not data:
        raise HTTPException(400, "Empty file - recording may have failed")
    name = f"{uuid.uuid4().hex}{EXT.get(mime, '.bin')}"
    path = UPLOAD_DIR / name
    path.write_bytes(data)
    m = MediaAttachment(client_id=client_id, owner_type=owner_type, owner_id=owner.id, kind=kind, mime_type=mime,
                        file_name=file.filename or name, stored_path=name, size_bytes=len(data), duration_s=duration_s)
    db.add(m)
    log(db, "public", "media_uploaded", owner_type, owner.id, f"{kind} {len(data)} bytes")
    db.commit()
    return {**media_out(m), "created": True}


@router.get("", summary="List attachments for a record (staff)")
def list_media(owner_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    return [media_out(m) for m in db.query(MediaAttachment).filter(MediaAttachment.owner_id == owner_id).all()]


@router.get("/{media_id}/file", summary="Download attachment (staff only)")
def get_file(media_id: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    m = db.get(MediaAttachment, media_id)
    if not m:
        raise HTTPException(404, "Attachment not found")
    path = UPLOAD_DIR / os.path.basename(m.stored_path)
    if not path.exists():
        raise HTTPException(410, "File missing from storage")
    return FileResponse(path, media_type=m.mime_type, filename=m.file_name)
