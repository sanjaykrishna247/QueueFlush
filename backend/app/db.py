"""
QueueFlush AI — Database setup (SQLAlchemy + SQLite)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(os.path.dirname(__file__), '..', 'queueflush.db')}"
)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # lightweight migration for databases created before audit timestamps existed
    from sqlalchemy import inspect, text
    cols = {c["name"] for c in inspect(engine).get_columns("safety_events")}
    if "created_at" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE safety_events ADD COLUMN created_at DATETIME"))
