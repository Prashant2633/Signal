"""Seed the database with realistic demo data.

Run with:  python -m app.seed   (from the backend/ directory)

Creates several users, mutual contacts, a handful of 1:1 conversations, one
group, and a back-and-forth message history with read receipts so the app is
immediately usable. Safe to re-run: it drops and recreates all tables.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .database import Base, SessionLocal, engine
from .models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    Reaction,
    User,
)

NOW = datetime.now(timezone.utc)


def t(minutes_ago: int) -> datetime:
    return NOW - timedelta(minutes=minutes_ago)


def run() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # ----- Users ----------------------------------------------------------
    users_spec = [
        ("alice", "+15550000001", "Alice Carter", "#3b7ddd", "At the gym 🏋️"),
        ("bob", "+15550000002", "Bob Nguyen", "#10a37f", "Available on Signal"),
        ("carol", "+15550000003", "Carol Diaz", "#e6618a", "Working from home"),
        ("dave", "+15550000004", "Dave Kim", "#f0a500", "Travelling ✈️"),
        ("erin", "+15550000005", "Erin Walsh", "#8b5cf6", "Coffee first ☕"),
    ]
    users: dict[str, User] = {}
    for username, phone, name, color, about in users_spec:
        u = User(
            username=username,
            phone=phone,
            display_name=name,
            avatar_color=color,
            about=about,
            last_seen=t(5),
        )
        db.add(u)
        users[username] = u
    db.flush()

    # ----- Contacts (everyone knows everyone) -----------------------------
    for owner in users.values():
        for other in users.values():
            if owner.id != other.id:
                db.add(Contact(owner_id=owner.id, contact_id=other.id))

    def make_direct(a: User, b: User) -> Conversation:
        conv = Conversation(type="direct", created_by=a.id, avatar_color=b.avatar_color,
                            last_message_at=NOW)
        db.add(conv)
        db.flush()
        db.add_all([
            ConversationMember(conversation_id=conv.id, user_id=a.id),
            ConversationMember(conversation_id=conv.id, user_id=b.id),
        ])
        return conv

    def add_message(conv: Conversation, sender: User, text: str, ago: int,
                    status: str = "read", readers: list[User] | None = None) -> Message:
        msg = Message(
            conversation_id=conv.id, sender_id=sender.id, content=text,
            status=status, created_at=t(ago),
        )
        db.add(msg)
        db.flush()
        for r in readers or []:
            if r.id != sender.id:
                db.add(MessageReceipt(message_id=msg.id, user_id=r.id, status="read"))
        conv.last_message_at = max(conv.last_message_at, msg.created_at)
        return msg

    # ----- Alice <-> Bob ---------------------------------------------------
    ab = make_direct(users["alice"], users["bob"])
    add_message(ab, users["bob"], "Hey Alice! Are we still on for lunch tomorrow?", 240, readers=[users["alice"]])
    add_message(ab, users["alice"], "Hi Bob! Yes definitely 😄 12:30 at the usual place?", 238, readers=[users["bob"]])
    add_message(ab, users["bob"], "Perfect. I'll book a table.", 235, readers=[users["alice"]])
    last_ab = add_message(ab, users["alice"], "Great, see you then!", 30, status="delivered")

    # mark alice's read cursor in the bob convo
    for m in ab.members:
        if m.user_id == users["alice"].id:
            m.last_read_message_id = last_ab.id

    # ----- Alice <-> Carol -------------------------------------------------
    ac = make_direct(users["alice"], users["carol"])
    add_message(ac, users["carol"], "Did you see the new design mockups?", 180, readers=[users["alice"]])
    m = add_message(ac, users["alice"], "Yes! They look amazing 🔥", 175, readers=[users["carol"]])
    db.add(Reaction(message_id=m.id, user_id=users["carol"].id, emoji="❤️"))
    add_message(ac, users["carol"], "Sending the final files over shortly.", 12, status="sent")

    # ----- Bob <-> Dave ----------------------------------------------------
    bd = make_direct(users["bob"], users["dave"])
    add_message(bd, users["dave"], "Landed in Tokyo 🛬", 600, readers=[users["bob"]])
    add_message(bd, users["bob"], "Safe travels! Bring back snacks 🍡", 595, readers=[users["dave"]])

    # ----- Group: Weekend Plans -------------------------------------------
    group = Conversation(type="group", name="Weekend Plans 🎉", created_by=users["alice"].id,
                        avatar_color="#10a37f", last_message_at=NOW)
    db.add(group)
    db.flush()
    db.add(ConversationMember(conversation_id=group.id, user_id=users["alice"].id, role="admin"))
    for uname in ("bob", "carol", "dave", "erin"):
        db.add(ConversationMember(conversation_id=group.id, user_id=users[uname].id, role="member"))
    db.flush()

    db.add(Message(conversation_id=group.id, sender_id=None, type="system",
                content="Alice Carter created the group", created_at=t(300)))
    everyone = list(users.values())
    add_message(group, users["alice"], "Hey everyone! Who's free this Saturday?", 295, readers=everyone)
    add_message(group, users["bob"], "I'm in! 🙌", 290, readers=everyone)
    add_message(group, users["carol"], "Same here. Picnic in the park?", 288, readers=everyone)
    gm = add_message(group, users["erin"], "Love that idea ☀️", 285, readers=[users["alice"], users["bob"]])
    db.add(Reaction(message_id=gm.id, user_id=users["alice"].id, emoji="👍"))
    db.add(Reaction(message_id=gm.id, user_id=users["carol"].id, emoji="👍"))
    add_message(group, users["dave"], "I'll bring the frisbee 🥏", 8, status="delivered",
                readers=[users["alice"]])

    db.commit()
    db.close()

    print("Seeded demo data:")
    print("  Users (login with phone OR username, OTP = 123456):")
    for username, phone, name, *_ in users_spec:
        print(f"    - {name:<14} username='{username}'  phone='{phone}'")


if __name__ == "__main__":
    run()
