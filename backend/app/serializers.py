"""Plain-dict serializers shared by the REST routers and the WebSocket layer.

Keeping these as dict builders (rather than only Pydantic models) lets the
WebSocket code broadcast the exact same JSON shape the REST API returns.
"""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Conversation, ConversationMember, Message, User


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "phone": user.phone,
        "display_name": user.display_name,
        "about": user.about,
        "avatar_color": user.avatar_color,
        "avatar_url": user.avatar_url,
        "is_online": user.is_online,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }


def serialize_message(msg: Message) -> dict:
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "type": msg.type,
        "content": msg.content,
        "status": msg.status,
        "reply_to_id": msg.reply_to_id,
        "edited": msg.edited,
        "deleted": msg.deleted,
        "expires_at": msg.expires_at.isoformat() if msg.expires_at else None,
        "created_at": msg.created_at.isoformat(),
        "reactions": [
            {"emoji": r.emoji, "user_id": r.user_id} for r in msg.reactions
        ],
        "receipts": [
            {"user_id": rc.user_id, "status": rc.status} for rc in msg.receipts
        ],
    }


def unread_count(db: Session, conv: Conversation, member: ConversationMember) -> int:
    """Number of messages after the member's read cursor, excluding their own."""
    q = db.query(func.count(Message.id)).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != member.user_id,
    )
    if member.last_read_message_id:
        last_read = db.get(Message, member.last_read_message_id)
        if last_read:
            q = q.filter(Message.created_at > last_read.created_at)
    return q.scalar() or 0


def serialize_conversation(db: Session, conv: Conversation, viewer_id: str) -> dict:
    members = [
        {
            "user": serialize_user(m.user),
            "role": m.role,
            "muted": m.muted,
        }
        for m in conv.members
    ]
    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    viewer_member = next((m for m in conv.members if m.user_id == viewer_id), None)
    unread = unread_count(db, conv, viewer_member) if viewer_member else 0

    return {
        "id": conv.id,
        "type": conv.type,
        "name": conv.name,
        "avatar_color": conv.avatar_color,
        "disappearing_seconds": conv.disappearing_seconds,
        "created_by": conv.created_by,
        "last_message_at": conv.last_message_at.isoformat(),
        "members": members,
        "last_message": serialize_message(last_msg) if last_msg else None,
        "unread_count": unread,
    }
