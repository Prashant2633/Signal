"""Direct + group conversation management."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Conversation, ConversationMember, Message, User
from ..schemas import (
    ConversationOut,
    CreateDirectRequest,
    CreateGroupRequest,
    UpdateGroupRequest,
)
from ..serializers import serialize_conversation, serialize_message
from ..ws_manager import manager

router = APIRouter(prefix="/conversations", tags=["conversations"])

GROUP_COLORS = ["#3b7ddd", "#10a37f", "#e6618a", "#f0a500", "#8b5cf6", "#ef4444"]


def member_ids(conv: Conversation) -> list[str]:
    return [m.user_id for m in conv.members]


def _require_membership(db: Session, conv_id: str, user_id: str) -> Conversation:
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if user_id not in member_ids(conv):
        raise HTTPException(403, "You are not a member of this conversation")
    return conv


async def _system_message(db: Session, conv: Conversation, text: str) -> dict:
    """Insert a 'system' message (e.g. 'Alice added Bob') and broadcast it."""
    msg = Message(conversation_id=conv.id, sender_id=None, type="system", content=text)
    conv.last_message_at = datetime.now(timezone.utc)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    payload = serialize_message(msg)
    await manager.send_to_users(member_ids(conv), {"type": "message", "data": payload})
    return payload


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(ConversationMember)
        .filter(ConversationMember.user_id == current.id)
        .all()
    )
    convs = [m.conversation for m in memberships]
    convs.sort(key=lambda c: c.last_message_at, reverse=True)
    return [serialize_conversation(db, c, current.id) for c in convs]


@router.get("/{conv_id}", response_model=ConversationOut)
def get_conversation(
    conv_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _require_membership(db, conv_id, current.id)
    return serialize_conversation(db, conv, current.id)


@router.post("/direct", response_model=ConversationOut)
def create_direct(
    body: CreateDirectRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    other = db.get(User, body.user_id)
    if not other:
        raise HTTPException(404, "User not found")
    if other.id == current.id:
        raise HTTPException(400, "Cannot start a conversation with yourself")

    # Reuse an existing 1:1 thread between these two users if one exists.
    for m in db.query(ConversationMember).filter(ConversationMember.user_id == current.id):
        conv = m.conversation
        if conv.type == "direct" and other.id in member_ids(conv):
            return serialize_conversation(db, conv, current.id)

    conv = Conversation(type="direct", created_by=current.id, avatar_color=other.avatar_color)
    db.add(conv)
    db.flush()
    db.add_all(
        [
            ConversationMember(conversation_id=conv.id, user_id=current.id, role="member"),
            ConversationMember(conversation_id=conv.id, user_id=other.id, role="member"),
        ]
    )
    db.commit()
    db.refresh(conv)
    return serialize_conversation(db, conv, current.id)


@router.post("/group", response_model=ConversationOut)
async def create_group(
    body: CreateGroupRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.name.strip():
        raise HTTPException(400, "Group name is required")

    member_set = {current.id, *body.member_ids}
    color = GROUP_COLORS[len(body.name) % len(GROUP_COLORS)]
    conv = Conversation(
        type="group", name=body.name.strip(), created_by=current.id, avatar_color=color
    )
    db.add(conv)
    db.flush()
    for uid in member_set:
        if db.get(User, uid):
            role = "admin" if uid == current.id else "member"
            db.add(ConversationMember(conversation_id=conv.id, user_id=uid, role=role))
    db.commit()
    db.refresh(conv)

    await _system_message(db, conv, f"{current.display_name} created the group")
    payload = serialize_conversation(db, conv, current.id)
    # Notify every member so the new group appears in their list immediately.
    await manager.send_to_users(member_ids(conv), {"type": "conversation", "data": payload})
    return payload


@router.patch("/{conv_id}", response_model=ConversationOut)
async def update_group(
    conv_id: str,
    body: UpdateGroupRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _require_membership(db, conv_id, current.id)
    if conv.type != "group":
        raise HTTPException(400, "Only groups can be updated")
    if body.name is not None:
        conv.name = body.name.strip()
    if body.disappearing_seconds is not None:
        conv.disappearing_seconds = body.disappearing_seconds
    db.commit()
    db.refresh(conv)
    payload = serialize_conversation(db, conv, current.id)
    await manager.send_to_users(member_ids(conv), {"type": "conversation", "data": payload})
    return payload


def _require_admin(conv: Conversation, user_id: str) -> None:
    me = next((m for m in conv.members if m.user_id == user_id), None)
    if not me or me.role != "admin":
        raise HTTPException(403, "Only group admins can do that")


@router.post("/{conv_id}/members", response_model=ConversationOut)
async def add_member(
    conv_id: str,
    body: CreateDirectRequest,  # reuses { user_id }
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _require_membership(db, conv_id, current.id)
    if conv.type != "group":
        raise HTTPException(400, "Members can only be added to groups")
    _require_admin(conv, current.id)

    target = db.get(User, body.user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if target.id in member_ids(conv):
        raise HTTPException(409, "Already a member")

    db.add(ConversationMember(conversation_id=conv.id, user_id=target.id, role="member"))
    db.commit()
    db.refresh(conv)
    await _system_message(db, conv, f"{current.display_name} added {target.display_name}")
    payload = serialize_conversation(db, conv, current.id)
    await manager.send_to_users(member_ids(conv), {"type": "conversation", "data": payload})
    return payload


@router.delete("/{conv_id}/members/{user_id}", response_model=ConversationOut)
async def remove_member(
    conv_id: str,
    user_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _require_membership(db, conv_id, current.id)
    if conv.type != "group":
        raise HTTPException(400, "Members can only be removed from groups")
    # Admins can remove anyone; members may remove themselves (leave).
    if user_id != current.id:
        _require_admin(conv, current.id)

    target_member = next((m for m in conv.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(404, "Not a member")

    target = db.get(User, user_id)
    notify = member_ids(conv)  # capture before removal so the leaver also hears it
    db.delete(target_member)
    db.commit()
    db.refresh(conv)

    verb = "left the group" if user_id == current.id else "was removed"
    actor = target.display_name if user_id == current.id else target.display_name
    await _system_message(db, conv, f"{actor} {verb}")
    payload = serialize_conversation(db, conv, current.id)
    await manager.send_to_users(notify, {"type": "conversation", "data": payload})
    return payload
