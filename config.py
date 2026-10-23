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
VALEURS_VRAI = {"1", "true", "yes", "oui"}
VALEURS_FAUX = {"0", "false", "no", "non"}


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
    return os.getenv("SQL_ECHO", "false").strip().lower() in VALEURS_VRAI


def get_auto_init_db() -> bool:
    return os.getenv("AUTO_INIT_DB", "true").strip().lower() in VALEURS_VRAI


def get_pool_settings() -> dict:
    return {
        "pool_pre_ping": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
    }


# --- Configuration passerelle httpSMS (https://docs.httpsms.com) ---

def get_httpsms_api_url() -> str:
    """URL de l'endpoint d'envoi httpSMS."""
    return (
        os.getenv("HTTPSMS_API_URL", "https://api.httpsms.com/v1/messages/send").strip()
        or "https://api.httpsms.com/v1/messages/send"
    )


def get_httpsms_api_key() -> str:
    """Cle API du compte httpSMS (depuis https://httpsms.com/settings).

    Note : la 'Phone API Key' s'entre uniquement dans l'application Android httpSMS ;
    le serveur backend utilise la cle API du compte dans l'en-tete `x-api-key`.
    """
    cle = os.getenv("HTTPSMS_API_KEY", "").strip()
    if cle == "votre-cle-compte-httpsms":
        return ""
    return cle


def get_httpsms_from_number() -> str:
    """Numero E.164 par defaut du telephone Android passerelle (ex: +22670000000)."""
    return os.getenv("HTTPSMS_FROM_NUMBER", "").strip()


def get_httpsms_webhook_signing_key() -> str:
    """Cle secrete de signature JWT (HS256) du webhook httpSMS."""
    return os.getenv("HTTPSMS_WEBHOOK_SIGNING_KEY", "").strip()


def get_httpsms_alert_to() -> str:
    """Numero E.164 optionnel recevant les alertes sanitaires Faso FDA par SMS."""
    return os.getenv("HTTPSMS_ALERT_TO", "").strip()


def get_httpsms_timeout() -> float:
    """Delai maximal (secondes) pour l'appel HTTP sortant vers api.httpsms.com."""
    return float(os.getenv("HTTPSMS_TIMEOUT", "10.0"))


def is_httpsms_enabled() -> bool:
    """Indique si l'envoi reel de SMS via httpSMS est actif.

    - Si `HTTPSMS_ENABLED` est defini explicitement (`true` / `false`), sa valeur prime.
    - Sinon : actif automatiquement en mode `online` des que `HTTPSMS_API_KEY` est renseignee,
      et inactif (mode simulation locale) en mode `local`.
    """
    brut = os.getenv("HTTPSMS_ENABLED", "").strip().lower()
    if brut in VALEURS_VRAI:
        return True
    if brut in VALEURS_FAUX:
        return False
    return is_online() and bool(get_httpsms_api_key())


def diagnostic_httpsms() -> str:
    """Retourne la raison exacte lorsque l'envoi httpSMS est en mode simulation."""
    brut = os.getenv("HTTPSMS_ENABLED", "").strip().lower()
    if brut in VALEURS_FAUX:
        return "HTTPSMS_ENABLED=false (passez HTTPSMS_ENABLED=true ou supprimez-la en mode online)"
    if not get_httpsms_api_key():
        return "HTTPSMS_API_KEY absente ou non renseignee"
    if not is_online() and brut not in VALEURS_VRAI:
        return f"APP_ENV={get_app_env()} sans HTTPSMS_ENABLED=true (passez APP_ENV=online ou HTTPSMS_ENABLED=true)"
    return "actif"
