"""Password hashing (bcrypt), JWT tokens and role-based authorization dependencies."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, SECRET_KEY
from .database import get_db
from .models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

ROLE_ADMIN = "admin"
ROLE_COORDINATOR = "coordinator"
ROLE_VOLUNTEER = "volunteer"
ROLE_PUBLIC = "public"
STAFF = (ROLE_ADMIN, ROLE_COORDINATOR)
OPERATIONS = (ROLE_ADMIN, ROLE_COORDINATOR, ROLE_VOLUNTEER)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user.username, "role": user.role_name, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user or not user.is_active:
        return None
    return user


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    user = _decode(token, db)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def get_optional_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
    return _decode(token, db) if token else None


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role_name not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"This action requires one of the roles: {', '.join(roles)}")
        return user
    return checker


require_staff = require_roles(*STAFF)
require_operations = require_roles(*OPERATIONS)
require_admin = require_roles(ROLE_ADMIN)
