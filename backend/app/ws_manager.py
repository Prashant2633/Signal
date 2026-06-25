"""In-memory WebSocket connection manager.

Tracks the set of live sockets per user (a user may have several tabs/devices
open). Events are routed to users rather than to raw sockets so that messaging,
typing, presence and receipt updates can be fanned out to every member of a
conversation.

For a single-process deployment this in-memory map is sufficient. A multi-worker
deployment would swap this for a Redis pub/sub backplane — the public method
surface would stay the same.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[user_id].add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket) -> bool:
        """Remove a socket. Returns True if the user has no sockets left (offline)."""
        async with self._lock:
            sockets = self._connections.get(user_id)
            if sockets and ws in sockets:
                sockets.remove(ws)
            now_offline = not self._connections.get(user_id)
            if now_offline:
                self._connections.pop(user_id, None)
            return now_offline

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: str, event: dict) -> None:
        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.send_json(event)
            except Exception:
                # Socket is dead; it will be cleaned up by the disconnect handler.
                pass

    async def send_to_users(self, user_ids: list[str], event: dict) -> None:
        await asyncio.gather(*(self.send_to_user(uid, event) for uid in set(user_ids)))


manager = ConnectionManager()
