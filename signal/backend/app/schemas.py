"""Pydantic request/response models (API contract)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class OtpRequest(BaseModel):
    identifier: str  # phone number or username


class OtpResponse(BaseModel):
    is_new_user: bool
    # The mock OTP is returned in the response so the demo is friction-free.
    dev_otp: str


class VerifyRequest(BaseModel):
    identifier: str
    otp: str
    # Only required when registering a brand-new user.
    display_name: str | None = None
    username: str | None = None
    avatar_color: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------------------------------------------------------------------------
# Users / contacts
# ---------------------------------------------------------------------------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    phone: str | None
    display_name: str
    about: str
    avatar_color: str
    avatar_url: str | None
    is_online: bool
    last_seen: datetime


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    about: str | None = None
    avatar_color: str | None = None


class AddContactRequest(BaseModel):
    identifier: str  # username or phone of the person to add
    nickname: str | None = None


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
class CreateDirectRequest(BaseModel):
    user_id: str


class CreateGroupRequest(BaseModel):
    name: str
    member_ids: list[str]


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    disappearing_seconds: int | None = None


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserOut
    role: str
    muted: bool


class ConversationOut(BaseModel):
    id: str
    type: str
    name: str | None
    avatar_color: str
    disappearing_seconds: int
    created_by: str | None
    last_message_at: datetime
    members: list[MemberOut]
    last_message: "MessageOut | None" = None
    unread_count: int = 0


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
class SendMessageRequest(BaseModel):
    content: str
    reply_to_id: str | None = None
    # Optional client-generated id so the sender can reconcile its optimistic bubble.
    client_id: str | None = None


class ReactionOut(BaseModel):
    emoji: str
    user_id: str


class ReceiptOut(BaseModel):
    user_id: str
    status: str


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str | None
    type: str
    content: str
    status: str
    reply_to_id: str | None
    edited: bool
    deleted: bool
    expires_at: datetime | None
    created_at: datetime
    reactions: list[ReactionOut] = []
    receipts: list[ReceiptOut] = []


TokenResponse.model_rebuild()
ConversationOut.model_rebuild()
