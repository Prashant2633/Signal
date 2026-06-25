"""Sending/listing messages, read receipts and reactions."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Conversation, ConversationMember, Message, MessageReceipt, Reaction, User
from ..schemas import MessageOut, SendMessageRequest
from ..serializers import serialize_message
from ..ws_manager import manager
from .conversations import member_ids

router = APIRouter(tags=["messages"])


def _require_membership(db: Session, conv_id: str, user_id: str) -> Conversation:
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if user_id not in member_ids(conv):
        raise HTTPException(403, "Not a member of this conversation")
    return conv


def recompute_status(db: Session, msg: Message, conv: Conversation) -> None:
    """Roll up per-recipient receipts into the sender-facing message status.

    'read'      — every other member has read it.
    'delivered' — every other member has at least received it.
    'sent'      — otherwise.
    """
    others = [uid for uid in member_ids(conv) if uid != msg.sender_id]
    if not others:
        return
    receipts = {r.user_id: r.status for r in msg.receipts}
    if all(receipts.get(uid) == "read" for uid in others):
        msg.status = "read"
    elif all(receipts.get(uid) in ("delivered", "read") for uid in others):
        msg.status = "delivered"
    else:
        msg.status = "sent"


@router.get("/conversations/{conv_id}/messages", response_model=list[MessageOut])
def list_messages(
    conv_id: str,
    before: str | None = None,
    limit: int = 50,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, conv_id, current.id)
    q = db.query(Message).filter(Message.conversation_id == conv_id)
    if before:
        anchor = db.get(Message, before)
        if anchor:
            q = q.filter(Message.created_at < anchor.created_at)
    msgs = q.order_by(Message.created_at.desc()).limit(min(limit, 100)).all()
    msgs.reverse()  # return in chronological order
    return [serialize_message(m) for m in msgs]


@router.post("/conversations/{conv_id}/messages", response_model=MessageOut)
async def send_message(
    conv_id: str,
    body: SendMessageRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _require_membership(db, conv_id, current.id)
    if not body.content.strip():
        raise HTTPException(400, "Message cannot be empty")

    expires_at = None
    if conv.disappearing_seconds:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=conv.disappearing_seconds)

    msg = Message(
        conversation_id=conv.id,
        sender_id=current.id,
        content=body.content.strip(),
        reply_to_id=body.reply_to_id,
        status="sent",
        expires_at=expires_at,
    )
    conv.last_message_at = datetime.now(timezone.utc)
    db.add(msg)
    db.flush()  # assign msg.id before creating receipts that reference it

    # Auto-mark as delivered for any recipient currently connected (online).
    for uid in member_ids(conv):
        if uid != current.id and manager.is_online(uid):
            db.add(MessageReceipt(message_id=msg.id, user_id=uid, status="delivered"))
    db.flush()
    recompute_status(db, msg, conv)
    db.commit()
    db.refresh(msg)

    payload = serialize_message(msg)
    # `client_id` lets the sender reconcile its optimistic bubble with the saved row.
    event = {"type": "message", "data": payload, "client_id": body.client_id}
    await manager.send_to_users(member_ids(conv), event)
    return payload


@router.post("/conversations/{conv_id}/read")
async def mark_read(
    conv_id: str,
    up_to_message_id: str = Body(..., embed=True),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark every message up to (and including) `up_to_message_id` as read."""
    conv = _require_membership(db, conv_id, current.id)
    anchor = db.get(Message, up_to_message_id)
    if not anchor:
        raise HTTPException(404, "Message not found")

    member = next(m for m in conv.members if m.user_id == current.id)
    member.last_read_message_id = anchor.id

    unread = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id,
            Message.sender_id != current.id,
            Message.created_at <= anchor.created_at,
        )
        .all()
    )
    touched_senders: set[str] = set()
    for m in unread:
        receipt = next((r for r in m.receipts if r.user_id == current.id), None)
        if receipt is None:
            receipt = MessageReceipt(message_id=m.id, user_id=current.id, status="read")
            db.add(receipt)
            m.receipts.append(receipt)
        receipt.status = "read"
        recompute_status(db, m, conv)
        if m.sender_id:
            touched_senders.add(m.sender_id)
    db.commit()

    # Tell the original senders their messages were read (double blue check).
    event = {
        "type": "receipt",
        "conversation_id": conv_id,
        "reader_id": current.id,
        "status": "read",
        "up_to": anchor.created_at.isoformat(),
    }
    await manager.send_to_users(list(touched_senders), event)
    return {"ok": True}


@router.post("/messages/{message_id}/reactions", response_model=MessageOut)
async def toggle_reaction(
    message_id: str,
    emoji: str = Body(..., embed=True),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.get(Message, message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    conv = _require_membership(db, msg.conversation_id, current.id)

    existing = (
        db.query(Reaction)
        .filter(Reaction.message_id == message_id, Reaction.user_id == current.id)
        .first()
    )
    if existing and existing.emoji == emoji:
        db.delete(existing)  # toggle off
    elif existing:
        existing.emoji = emoji  # swap emoji
    else:
        db.add(Reaction(message_id=message_id, user_id=current.id, emoji=emoji))
    db.commit()
    db.refresh(msg)

    payload = serialize_message(msg)
    await manager.send_to_users(member_ids(conv), {"type": "message_update", "data": payload})
    return payload
