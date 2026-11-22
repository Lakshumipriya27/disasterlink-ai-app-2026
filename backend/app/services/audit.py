from sqlalchemy.orm import Session

from ..models import ActivityLog, Notification


def log(db: Session, actor: str, action: str, entity_type: str = "", entity_id: str = "", details: str = ""):
    db.add(ActivityLog(actor=actor or "system", action=action, entity_type=entity_type, entity_id=entity_id or "",
                       details=details[:2000]))


def notify(db: Session, kind: str, title: str, message: str = "", severity: str = "info", reference_id: str | None = None):
    db.add(Notification(kind=kind, title=title, message=message, severity=severity, reference_id=reference_id))
