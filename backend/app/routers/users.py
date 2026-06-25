"""User directory, profile editing and the personal contact list."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Contact, User
from ..schemas import AddContactRequest, ProfileUpdate, UserOut
from ..serializers import serialize_user

router = APIRouter(tags=["users"])


@router.patch("/users/me", response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.display_name is not None:
        current.display_name = body.display_name
    if body.about is not None:
        current.about = body.about
    if body.avatar_color is not None:
        current.avatar_color = body.avatar_color
    db.commit()
    db.refresh(current)
    return UserOut(**serialize_user(current))


@router.get("/users/search", response_model=list[UserOut])
def search_users(
    q: str = "",
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search the global directory by username, display name or phone."""
    query = db.query(User).filter(User.id != current.id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.display_name.ilike(like),
                User.phone.ilike(like),
            )
        )
    users = query.order_by(User.display_name).limit(25).all()
    return [UserOut(**serialize_user(u)) for u in users]


@router.get("/contacts", response_model=list[UserOut])
def list_contacts(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contacts = (
        db.query(Contact)
        .filter(Contact.owner_id == current.id)
        .order_by(Contact.created_at.desc())
        .all()
    )
    return [UserOut(**serialize_user(c.contact_user)) for c in contacts]


@router.post("/contacts", response_model=UserOut)
def add_contact(
    body: AddContactRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    identifier = body.identifier.strip()
    target = (
        db.query(User)
        .filter(or_(User.username == identifier, User.phone == identifier))
        .first()
    )
    if not target:
        raise HTTPException(404, "No user found with that username or phone")
    if target.id == current.id:
        raise HTTPException(400, "You cannot add yourself")

    existing = (
        db.query(Contact)
        .filter(Contact.owner_id == current.id, Contact.contact_id == target.id)
        .first()
    )
    if not existing:
        db.add(Contact(owner_id=current.id, contact_id=target.id, nickname=body.nickname))
        db.commit()
    return UserOut(**serialize_user(target))
