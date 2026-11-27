"""
Authentication & Authorization helpers for EduMentor AI.
Provides JWT verification, current user dependencies, and session ownership checks.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.models import InterviewSession, User

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": subject, "exp": expire}, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """Decode a JWT access token and return the user ID (sub), or None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        return str(subject) if subject else None
    except JWTError:
        return None


async def get_user_by_token(token: str, db: AsyncSession) -> Optional[User]:
    user_id = decode_access_token(token)
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Resolve the authenticated user if a Bearer token is supplied.
    Raises 401 if a token is supplied but invalid/expired so clients can clear stale tokens.
    Returns None for unauthenticated guest requests.
    """
    if credentials is None or not credentials.credentials:
        return None

    user = await get_user_by_token(credentials.credentials, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_user(
    user: Optional[User] = Depends(get_optional_current_user),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vui lòng đăng nhập để sử dụng tính năng này.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def ensure_session_access(
    session: InterviewSession, current_user: Optional[User]
) -> None:
    """
    Enforce session ownership:
    - Sessions owned by a registered user can only be accessed by that user.
    - Anonymous guest sessions (user_id is None) remain accessible without ownership conflict.
    """
    if session.user_id is None:
        return
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bạn cần đăng nhập để truy cập phiên luyện tập này.",
        )
    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập phiên luyện tập này.",
        )
