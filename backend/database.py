import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database URL from environment or default local SQLite database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
raw_db_url = os.getenv(
    "DATABASE_URL", 
    f"sqlite:///{os.path.join(BASE_DIR, 'polar_x.db')}"
)

# Cloud providers (e.g. Render, Railway, Heroku) often use postgres://, but SQLAlchemy requires postgresql://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = raw_db_url

# SQLite requires check_same_thread=False; PostgreSQL does not accept this argument
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
