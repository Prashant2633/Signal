# Signal - Secure Messaging Platform

<div align="center">

### 🚀 [**Try the Live Demo →**](https://signal-sand-iota.vercel.app)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-signal--sand--iota.vercel.app-blue?style=for-the-badge&logo=vercel)](https://signal-sand-iota.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-purple?style=for-the-badge&logo=render)](https://signal-him9.onrender.com/health)

> **Demo credentials** — Username: `alice` · OTP: `123456`  
> (also try `bob`, `carol`, `dave`, `erin` — open two tabs to see real-time messaging!)

</div>

---

A functional clone of the Signal messenger that recreates Signal's look, feel and
core messaging workflows: mocked phone/username onboarding, contacts, 1:1 and
group conversations, and **real-time** messaging with typing indicators, presence
and delivery/read receipts.

> Encryption is **simulated** (per the assignment) — the focus is the Signal UX
> and messaging workflows, not real cryptographic protocols.

| | |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand |
| **Backend** | Python · FastAPI · SQLAlchemy 2 · WebSockets · JWT |
| **Database** | SQLite |
| **Realtime** | Native WebSockets (messages, typing, presence, receipts) |

---

## ✨ Features

**Authentication / Onboarding**
- Register/login with a **phone number or username**, verified with a mocked OTP (`123456`)
- Set a display name + avatar colour during signup
- JWT session persistence (stays logged in across refreshes) and logout

**Contacts & Conversation list**
- Conversation list sorted by most recent activity
- Search conversations; search the user directory to start new chats
- Add contacts by username/phone
- Unread badges, last-message preview (with sender prefix in groups), timestamps
- Online / last-seen presence indicators (real, via WebSocket)

**1:1 Messaging**
- Send/receive text messages in **real time**
- Message timestamps + day separators
- Delivery / read receipts — the single ✓ / double ✓✓ / blue ✓✓ experience
- Typing indicators
- Message status lifecycle: `sending → sent → delivered → read`
- All messages persisted in SQLite

**Group Messaging**
- Create a group with a name + members
- Real-time group messages, view members, online status per member
- Admin controls: add / remove members, leave group (system messages announce changes)
- All group data + messages persisted

**Signal experience**
- Three-column layout (nav rail + conversation list + chat pane), light/dark themes
- Message bubbles & threading, reply/quote, emoji reactions
- Modals, search, toasts/notifications
- Settings (profile, appearance + privacy/notifications placeholders)
- Responsive: collapses to a single column on mobile

**Bonus implemented**
- Message reactions (emoji) · Reply-to / quoted messages · **Functional disappearing messages**
- Dark mode (default) + light mode · Responsive design · `Enter`-to-send

**Mocked placeholders (Coming Soon)**
- Voice / video calls · Stories · Linked devices · Real E2E encryption

---

## 🏗️ Architecture

```
signal/
├── backend/                  FastAPI app
│   ├── app/
│   │   ├── main.py           App factory, CORS, router registration
│   │   ├── config.py         Env-driven settings
│   │   ├── database.py       SQLAlchemy engine + session
│   │   ├── models.py         ORM models (the schema)
│   │   ├── schemas.py        Pydantic request/response models
│   │   ├── auth.py           JWT issue/verify + current-user dependency
│   │   ├── serializers.py    Shared dict serializers (REST + WS)
│   │   ├── ws_manager.py     In-memory WebSocket connection registry
│   │   ├── seed.py           Demo data seeder
│   │   └── routers/          auth · users · conversations · messages · ws
│   └── requirements.txt
└── frontend/                 Next.js app
    └── src/
        ├── app/              layout, globals.css, page.tsx (entry)
        ├── components/       Onboarding, Messenger, ConversationList,
        │                     ChatPane, MessageBubble, MessageInput, modals…
        └── lib/              api.ts · ws.ts · store.ts (Zustand) · types · utils · ui
```

**How realtime works.** Each client opens one WebSocket (`/ws?token=…`). The
backend keeps an in-memory map of `user_id → {sockets}`. REST endpoints remain the
source of truth (they persist data), and **after** persisting they fan out an event
to every relevant user's socket. The client store (`lib/store.ts`) applies those
events to update the UI. This keeps the data flow simple and consistent: *write via
REST → broadcast via WS → reconcile in the store* (optimistic sends are reconciled
by a `client_id`). For multi-process deploys, swap the in-memory manager for Redis
pub/sub — the interface stays the same.

---

## 🗄️ Database Schema

UUID string primary keys throughout. `Conversation.last_message_at` is denormalised
for cheap activity sorting. Read state is tracked both by a per-member cursor
(`last_read_message_id`, O(1) unread counts) and precise `MessageReceipt` rows
(delivered/read per recipient → the check-mark experience).

```
users(id, phone?, username, display_name, about, avatar_color, avatar_url?,
      is_online, last_seen, created_at)

contacts(id, owner_id→users, contact_id→users, nickname?, created_at)
      └─ UNIQUE(owner_id, contact_id)            -- personal address book

conversations(id, type['direct'|'group'], name?, avatar_color, created_by?,
              disappearing_seconds, created_at, last_message_at)

conversation_members(id, conversation_id→conversations, user_id→users,
                     role['admin'|'member'], last_read_message_id?, muted, joined_at)
      └─ UNIQUE(conversation_id, user_id)        -- membership + read cursor

messages(id, conversation_id→conversations, sender_id?→users,
         type['text'|'system'], content, reply_to_id?→messages,
         status['sent'|'delivered'|'read'], edited, deleted, expires_at?, created_at)

message_receipts(id, message_id→messages, user_id→users,
                 status['delivered'|'read'], updated_at)
      └─ UNIQUE(message_id, user_id)             -- per-recipient receipts

reactions(id, message_id→messages, user_id→users, emoji, created_at)
      └─ UNIQUE(message_id, user_id)             -- one reaction per user/message
```

**Relationships:** a user has many contacts, memberships and messages; a
conversation has many members and messages; a message has many receipts and
reactions and may reference another message (`reply_to_id`). System messages
(`sender_id = NULL`, `type = 'system'`) record group events like "Alice added Bob".

---

## 🔌 API Overview

All endpoints except `/auth/*` require `Authorization: Bearer <jwt>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/request-otp` | Check identifier, return mock OTP + is-new-user |
| `POST` | `/auth/verify` | Verify OTP, create on first login, return JWT + user |
| `GET`  | `/auth/me` | Current user |
| `PATCH`| `/users/me` | Update profile (name, about, colour) |
| `GET`  | `/users/search?q=` | Search the user directory |
| `GET` / `POST` | `/contacts` | List / add contacts |
| `GET`  | `/conversations` | List conversations (sorted, with unread + last message) |
| `GET`  | `/conversations/{id}` | Conversation detail |
| `POST` | `/conversations/direct` | Get-or-create a 1:1 conversation |
| `POST` | `/conversations/group` | Create a group |
| `PATCH`| `/conversations/{id}` | Rename group / set disappearing timer |
| `POST` / `DELETE` | `/conversations/{id}/members[/{uid}]` | Add / remove member (admin) |
| `GET` / `POST` | `/conversations/{id}/messages` | List / send messages |
| `POST` | `/conversations/{id}/read` | Mark read up to a message |
| `POST` | `/messages/{id}/reactions` | Toggle an emoji reaction |
| `WS`   | `/ws?token=` | Realtime channel |

**WebSocket events** — client→server: `typing`, `delivered`.
server→client: `message`, `message_update`, `conversation`, `receipt`, `typing`, `presence`.

Interactive API docs are available at `http://localhost:8000/docs` (Swagger UI).

---

## 🚀 Setup & Run

**Prerequisites:** Python 3.11+, Node 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:        .venv\Scripts\activate
# macOS / Linux:  source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed                       # seed demo users/conversations/messages
uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000` (docs at `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local               # defaults point at localhost:8000
npm run dev
```

App runs at `http://localhost:3000`.

### Try it
Log in with any seeded account — **username** `alice`, `bob`, `carol`, `dave`, `erin`
(or their phone numbers `+1555000000X`). The OTP is always **`123456`** (and is
pre-filled in the demo). Open two accounts in two browsers / a normal + incognito
window to watch real-time messaging, typing and read receipts live.

---

## ☁️ Deployment

- **Backend** (Render / Railway / Fly): start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `SECRET_KEY` and
  `CORS_ORIGINS` (your frontend URL). Run `python -m app.seed` once. For a durable
  DB, point `DATABASE_URL` at a mounted volume or Postgres.
- **Frontend** (Vercel / Netlify): set `NEXT_PUBLIC_API_URL` (`https://…`) and
  `NEXT_PUBLIC_WS_URL` (`wss://…`) to the deployed backend, then `npm run build`.

---

## 📝 Assumptions & Notes

- **Auth is mocked**: OTP is a fixed code and any identifier can register; no
  passwords. JWTs are signed with `SECRET_KEY`.
- **Encryption is simulated** — surfaced as UI affordances ("end-to-end encrypted")
  but no real key exchange.
- **Avatars** are rendered from initials + a deterministic colour (no file uploads),
  keeping the demo dependency-free.
- **Presence & typing** are ephemeral (in-memory); chat content is fully persisted.
- **Disappearing messages** are functional end-to-end: a per-conversation timer sets
  `expires_at` on new messages (UI shows a timer glyph).
- The in-memory WebSocket manager assumes a single backend process; scale-out would
  use a Redis backplane behind the same `ConnectionManager` interface.
