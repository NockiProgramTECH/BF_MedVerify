"""Gestion du moteur SQLAlchemy et des sessions ORM."""
import threading
from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_database_url, get_pool_settings, get_sql_echo

_verrou = threading.Lock()
_engine: Engine | None = None
_engine_url: str | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Retourne le moteur SQLAlchemy correspondant a la configuration active (APP_ENV)."""
    global _engine, _engine_url, _session_factory
    url = get_database_url()
    if _engine is not None and _engine_url == url:
        return _engine

    with _verrou:
        url = get_database_url()
        if _engine is None or _engine_url != url:
            if _engine is not None:
                _engine.dispose()
            _engine = create_engine(
                url,
                echo=get_sql_echo(),
                **get_pool_settings(),
            )
            _engine_url = url
            _session_factory = sessionmaker(
                bind=_engine,
                autoflush=False,
                autocommit=False,
                expire_on_commit=False,
            )
        return _engine


def SessionLocal() -> Session:
    """Ouvre une nouvelle session SQLAlchemy ORM."""
    get_engine()
    assert _session_factory is not None
    return _session_factory()


def get_db() -> Generator[Session, None, None]:
    """Dependance FastAPI fournissant une session ORM par requete."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
