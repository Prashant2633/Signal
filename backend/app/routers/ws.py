"""Real-time WebSocket endpoint.

A single socket per client multiplexes every live event: incoming messages,
typing indicators, presence and delivery/read receipts. The client authenticates
by passing its JWT as the `token` query parameter.

Client -> server events
    {"type": "typing", "conversation_id": str, "is_typing": bool}
    {"type": "delivered", "conversation_id": str, "message_id": str}

Server -> client events (also emitted by the REST layer)
    message | message_update | conversation | receipt | typing | presence
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..auth import decode_token
from ..database import SessionLocal
from ..models import Conversation, ConversationMember, Message, MessageReceipt, User
from ..serializers import serialize_user
from ..ws_manager import manager

router = APIRouter()


def _related_user_ids(db: Session, user_id: str) -> list[str]:
    """All users who share at least one conversation with `user_id`."""
    my_convs = [
        m.conversation_id
        for m in db.query(ConversationMember).filter(ConversationMember.user_id == user_id)
    ]
    if not my_convs:
        return []
    rows = (
        db.query(ConversationMember.user_id)
        .filter(ConversationMember.conversation_id.in_(my_convs))
        .distinct()
    )
    return [r[0] for r in rows if r[0] != user_id]


async def _broadcast_presence(db: Session, user: User) -> None:
    event = {
        "type": "presence",
        "user_id": user.id,
        "is_online": user.is_online,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }
    await manager.send_to_users(_related_user_ids(db, user.id), event)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=4001)
        db.close()
        return

    await manager.connect(user_id, websocket)
    user.is_online = True
    user.last_seen = datetime.now(timezone.utc)
    db.commit()
    await _broadcast_presence(db, user)

    try:
        while True:
            data = await websocket.receive_json()
            kind = data.get("type")

            if kind == "typing":
                conv = db.get(Conversation, data.get("conversation_id"))
                if not conv:
                    continue
                recipients = [m.user_id for m in conv.members if m.user_id != user_id]
                await manager.send_to_users(
                    recipients,
                    {
                        "type": "typing",
                        "conversation_id": conv.id,
                        "user_id": user_id,
                        "display_name": user.display_name,
                        "is_typing": bool(data.get("is_typing")),
                    },
                )

            elif kind == "delivered":
                # Recipient acknowledges receipt of a specific message.
                msg = db.get(Message, data.get("message_id"))
                if not msg or msg.sender_id == user_id:
                    continue
                receipt = (
                    db.query(MessageReceipt)
                    .filter(
                        MessageReceipt.message_id == msg.id,
                        MessageReceipt.user_id == user_id,
                    )
                    .first()
                )
                if receipt is None:
                    db.add(MessageReceipt(message_id=msg.id, user_id=user_id, status="delivered"))
                    db.commit()
                await manager.send_to_users(
                    [msg.sender_id] if msg.sender_id else [],
                    {
                        "type": "receipt",
                        "conversation_id": msg.conversation_id,
                        "reader_id": user_id,
                        "status": "delivered",
                        "message_id": msg.id,
                    },
                )

    except WebSocketDisconnect:
        pass
    finally:
        now_offline = await manager.disconnect(user_id, websocket)
        if now_offline:
            user.is_online = False
            user.last_seen = datetime.now(timezone.utc)
            db.commit()
            await _broadcast_presence(db, user)
        db.close()
