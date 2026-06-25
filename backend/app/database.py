"""Database engine, session factory and the declarative base.

We use a synchronous SQLAlchemy engine with SQLite. `check_same_thread=False` is
required because FastAPI may touch a session from a different thread than the one
that created it.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def get_db():
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
