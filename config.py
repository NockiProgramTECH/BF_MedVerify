"""Configuration centrale du projet BF-MedVerify.

La variable d'environnement `APP_ENV` pilote le mode de fonctionnement :
- `local`  : connexion a un serveur PostgreSQL local (via `LOCAL_DATABASE_URL` ou `POSTGRES_*`).
- `online` : connexion a une base PostgreSQL distante via `DATABASE_URL` (tout hebergeur :
             Render, Neon, Railway, Koyeb, AWS RDS, VPS, Supabase URI PostgreSQL, etc.).
"""
import os
from dotenv import load_dotenv
from sqlalchemy.engine import URL

load_dotenv()

ALIASES_LOCAL = {"local", "dev", "development"}
ALIASES_ONLINE = {"online", "prod", "production", "en_ligne"}


def get_app_env() -> str:
    """Retourne l'environnement normalise : 'local' ou 'online'."""
    brut = os.getenv("APP_ENV", "local").strip().lower()
    if brut in ALIASES_LOCAL:
        return "local"
    if brut in ALIASES_ONLINE:
        return "online"
    raise ValueError(
        f"Valeur APP_ENV invalide : '{brut}'. Utilisez 'local' ou 'online'."
    )


def is_local() -> bool:
    return get_app_env() == "local"


def is_online() -> bool:
    return get_app_env() == "online"


def normaliser_database_url(url: str) -> str:
    """Normalise l'URL PostgreSQL pour SQLAlchemy (driver psycopg2)."""
    u = url.strip()
    if u.startswith("postgres://"):
        return "postgresql+psycopg2://" + u[len("postgres://"):]
    if u.startswith("postgresql://"):
        return "postgresql+psycopg2://" + u[len("postgresql://"):]
    return u


def get_database_url(env: str | None = None) -> str:
    """Construit ou recupere l'URL de connexion PostgreSQL selon APP_ENV."""
    mode = env if env in ("local", "online") else get_app_env()

    if mode == "online":
        db_url = os.getenv("DATABASE_URL", "").strip()
        if not db_url:
            raise RuntimeError(
                "DATABASE_URL est manquant alors que APP_ENV=online. "
                "Definissez DATABASE_URL avec l'URL PostgreSQL de votre hebergeur."
            )
        return normaliser_database_url(db_url)

    # Mode local : serveur PostgreSQL local
    local_url = os.getenv("LOCAL_DATABASE_URL", "").strip()
    if local_url:
        return normaliser_database_url(local_url)

    host = os.getenv("POSTGRES_HOST", "localhost").strip() or "localhost"
    port = int(os.getenv("POSTGRES_PORT", "5432").strip() or "5432")
    user = os.getenv("POSTGRES_USER", "bfmv").strip() or "bfmv"
    password = os.getenv("POSTGRES_PASSWORD", "bfmv")
    database = os.getenv("POSTGRES_DB", "bfmv").strip() or "bfmv"

    return URL.create(
        drivername="postgresql+psycopg2",
        username=user,
        password=password,
        host=host,
        port=port,
        database=database,
    ).render_as_string(hide_password=False)


def get_pepper() -> bytes:
    return os.getenv("BFMV_PEPPER", "").encode()


def get_api_key() -> str:
    return os.getenv("API_KEY", "")


def get_sql_echo() -> bool:
    if is_online():
        return False
    return os.getenv("SQL_ECHO", "false").strip().lower() in ("1", "true", "yes", "oui")


def get_auto_init_db() -> bool:
    return os.getenv("AUTO_INIT_DB", "true").strip().lower() in ("1", "true", "yes", "oui")


def get_pool_settings() -> dict:
    return {
        "pool_pre_ping": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
    }
