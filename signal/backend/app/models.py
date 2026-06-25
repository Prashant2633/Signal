"""SQLAlchemy ORM models — the application's database schema.

Schema overview
---------------
User                 — a registered account (phone/username, profile).
Contact              — directional "saved contact" link between two users.
Conversation         — a 1:1 (`direct`) or `group` thread.
ConversationMember   — membership row (role, read cursor, mute) joining users<->conversations.
Message              — a single message in a conversation (text or system event).
MessageReceipt       — per-recipient delivery/read state for a message.
Reaction             — an emoji reaction by a user on a message.

Design notes
------------
* Primary keys are UUID strings — stable, non-guessable, and merge-friendly.
* Read state is tracked two ways that complement each other:
  - `ConversationMember.last_read_message_id` gives an O(1) unread count cursor.
  - `MessageReceipt` gives precise per-user delivered/read receipts for the
    single/double-check experience (and read-by lists in groups).
* `Conversation.last_message_at` is denormalised so the conversation list can be
  sorted by recent activity without scanning the messages table.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    phone: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String)
    about: Mapped[str] = mapped_column(String, default="Available on Signal")
    # Avatar is rendered from initials + a deterministic colour (no file storage needed).
    avatar_color: Mapped[str] = mapped_column(String, default="#3b7ddd")
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="owner", foreign_keys="Contact.owner_id", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["ConversationMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Contact(Base):
    """A user's personal address-book entry pointing at another user."""

    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("owner_id", "contact_id", name="uq_owner_contact"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    contact_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    owner: Mapped["User"] = relationship(back_populates="contacts", foreign_keys=[owner_id])
    contact_user: Mapped["User"] = relationship(foreign_keys=[contact_id])


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    type: Mapped[str] = mapped_column(String, default="direct")  # 'direct' | 'group'
    name: Mapped[str | None] = mapped_column(String, nullable=True)  # group name
    avatar_color: Mapped[str] = mapped_column(String, default="#6b7280")
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Functional disappearing messages: seconds-to-live, 0 = off.
    disappearing_seconds: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conv_member"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String, default="member")  # 'admin' | 'member'
    # Read cursor: id of the last message this member has read.
    last_read_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    conversation: Mapped["Conversation"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    sender_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, default="text")  # 'text' | 'system'
    content: Mapped[str] = mapped_column(Text, default="")
    # Optional self-referential reply (quoted message).
    reply_to_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    # Sender-side rollup status: 'sent' | 'delivered' | 'read'.
    status: Mapped[str] = mapped_column(String, default="sent")
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sender: Mapped["User | None"] = relationship(foreign_keys=[sender_id])
    reply_to: Mapped["Message | None"] = relationship(remote_side=[id])
    receipts: Mapped[list["MessageReceipt"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    reactions: Mapped[list["Reaction"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class MessageReceipt(Base):
    """Per-recipient delivery/read state for a message."""

    __tablename__ = "message_receipts"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_receipt"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="delivered")  # 'delivered' | 'read'
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    message: Mapped["Message"] = relationship(back_populates="receipts")


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_reaction"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    emoji: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    message: Mapped["Message"] = relationship(back_populates="reactions")
    user: Mapped["User"] = relationship()
