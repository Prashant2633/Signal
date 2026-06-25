"""FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import Base, engine
from .routers import auth, conversations, messages, users, ws

# Create tables on startup (SQLite). For a real project this would be Alembic.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Signal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "signal-api"}
