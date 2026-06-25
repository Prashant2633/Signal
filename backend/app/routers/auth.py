"""Mocked OTP authentication / onboarding.

Flow:
1. POST /auth/request-otp  -> tells the client whether the identifier is a new
   user and (for demo convenience) returns the fixed OTP.
2. POST /auth/verify       -> checks the OTP, creates the account on first login,
   and returns a JWT + the user profile.
"""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user
from ..config import MOCK_OTP
from ..database import get_db
from ..models import User
from ..schemas import (
    OtpRequest,
    OtpResponse,
    TokenResponse,
    UserOut,
    VerifyRequest,
)
from ..serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_COLORS = ["#3b7ddd", "#6b7280", "#10a37f", "#e6618a", "#f0a500", "#8b5cf6"]


def _find_user(db: Session, identifier: str) -> User | None:
    identifier = identifier.strip()
    return (
        db.query(User)
        .filter(or_(User.username == identifier, User.phone == identifier))
        .first()
    )


@router.post("/request-otp", response_model=OtpResponse)
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    existing = _find_user(db, body.identifier)
    return OtpResponse(is_new_user=existing is None, dev_otp=MOCK_OTP)


@router.post("/verify", response_model=TokenResponse)
def verify(body: VerifyRequest, db: Session = Depends(get_db)):
    if body.otp != MOCK_OTP:
        raise HTTPException(401, "Invalid OTP. Use the demo code 123456.")

    identifier = body.identifier.strip()
    user = _find_user(db, identifier)

    if user is None:
        # New account — registration requires a display name.
        if not body.display_name:
            raise HTTPException(400, "display_name is required to register")

        is_phone = identifier.startswith("+") or identifier.replace(" ", "").isdigit()
        username = (body.username or "").strip()
        if not username:
            # Derive a username from a phone-only signup.
            username = identifier if not is_phone else f"user{random.randint(1000, 9999)}"

        if db.query(User).filter(User.username == username).first():
            raise HTTPException(409, "Username already taken")

        user = User(
            phone=identifier if is_phone else None,
            username=username,
            display_name=body.display_name,
            avatar_color=body.avatar_color or random.choice(AVATAR_COLORS),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut(**serialize_user(user)))


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return UserOut(**serialize_user(current))
