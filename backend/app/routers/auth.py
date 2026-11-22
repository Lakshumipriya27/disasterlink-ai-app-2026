from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, utcnow
from ..security import create_access_token, get_current_user, verify_password
from ..services.audit import log

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=4, max_length=128)


def user_out(u: User) -> dict:
    return {"id": u.id, "username": u.username, "full_name": u.full_name, "email": u.email, "role": u.role_name,
            "volunteer_id": u.volunteer_id, "is_active": u.is_active, "is_demo": u.is_demo}


def _login(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username.strip().lower()).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Incorrect username or password")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")
    user.last_login = utcnow()
    log(db, user.username, "login", "user", str(user.id))
    db.commit()
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_out(user)}


@router.post("/login", summary="Login with JSON body; returns a JWT bearer token")
def login(body: LoginIn, db: Session = Depends(get_db)):
    return _login(db, body.username, body.password)


@router.post("/token", summary="OAuth2 password flow (used by the Swagger 'Authorize' button)")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return _login(db, form.username, form.password)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.post("/logout", summary="Stateless JWT: client discards the token; recorded for audit")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log(db, user.username, "logout", "user", str(user.id))
    db.commit()
    return {"ok": True}
