"""API FastAPI BF-MedVerify utilisant SQLAlchemy ORM, httpSMS et pilotee par APP_ENV."""
from contextlib import asynccontextmanager
import hmac
import mimetypes
from pathlib import Path
import unicodedata

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import fastapi_offline
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from bf_codes import bien_forme, empreinte, normaliser
from config import diagnostic_httpsms, get_api_key, get_app_env, get_auto_init_db, is_httpsms_enabled
from database import SessionLocal, get_db
from init_db import initialiser_base
from models import Produit
from services import verifier_code
from sms_client import (
    envoyer_alerte_fda_sms,
    envoyer_sms_httpsms,
    normaliser_numero,
    verifier_authentification_httpsms,
)

# Corrige le type MIME sur Windows (ou .js est parfois associe a text/plain -> page blanche Swagger)
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

API_KEY = get_api_key()  # cle secrete de l'API (dans l'URL du webhook : ?cle=...)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_auto_init_db():
        initialiser_base()
    yield


app = FastAPI(
    title="BF-MedVerify",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

# Fichiers statiques Swagger UI & ReDoc embarques localement (aucune dependance a cdn.jsdelivr.net)
_STATIC_DOCS_DIR = Path(fastapi_offline.__file__).parent / "static"
app.mount(
    "/static-offline-docs",
    StaticFiles(directory=str(_STATIC_DOCS_DIR)),
    name="static-offline-docs",
)


@app.get("/", include_in_schema=False)
def accueil():
    return RedirectResponse(url="docs")


@app.get("/docs", include_in_schema=False)
def swagger_ui_html() -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url="./openapi.json",
        title=f"{app.title} - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="./static-offline-docs/swagger-ui-bundle.js",
        swagger_css_url="./static-offline-docs/swagger-ui.css",
        swagger_favicon_url="./static-offline-docs/favicon.png",
    )


if app.swagger_ui_oauth2_redirect_url:
    @app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
    def swagger_ui_redirect() -> HTMLResponse:
        return get_swagger_ui_oauth2_redirect_html()


@app.get("/redoc", include_in_schema=False)
def redoc_html() -> HTMLResponse:
    return get_redoc_html(
        openapi_url="./openapi.json",
        title=f"{app.title} - ReDoc",
        redoc_js_url="./static-offline-docs/redoc.standalone.js",
        redoc_favicon_url="./static-offline-docs/favicon.png",
        with_google_fonts=False,
    )


def sans_accents(t: str) -> str:
    """Un accent = SMS en Unicode = 70 caracteres seulement."""
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def mmaa(iso: str) -> str:
    """'2028-03-31' -> '03/28'."""
    return f"{iso[5:7]}/{iso[2:4]}"


def fabriquer_message(r: dict) -> str:
    """SMS court : 160 caracteres maximum, ASCII sans accents."""
    res = r["resultat"]
    if res == "VRAI":
        m = (
            f"BF-MedVerify: AUTHENTIQUE. {r['produit']} {r['dosage']}, lot {r['lot']}, "
            f"exp {mmaa(r['expiration'])}. Comparez avec la boite. Si la maladie continue, consultez."
        )
    elif res == "DEJA_UTILISE":
        d = r["date_premiere"]
        m = (
            f"BF-MedVerify: ATTENTION. Code deja verifie le {d[8:10]}/{d[5:7]}. Si ce n'est pas vous, "
            "copie possible: ne prenez pas ce produit, rapportez-le a la pharmacie."
        )
    elif res == "EXPIRE":
        m = (
            f"BF-MedVerify: ATTENTION. Medicament expire ({mmaa(r['expiration'])}). "
            "Ne le prenez pas. Rapportez-le a la pharmacie."
        )
    elif res == "REVOQUE":
        m = (
            "BF-MedVerify: ATTENTION. Ce lot est signale (rappel ou suspicion). "
            "Ne le prenez pas. Rapportez-le a la pharmacie."
        )
    elif res == "LIMITE":
        m = "BF-MedVerify: Trop de demandes. Attendez 1 minute puis reessayez."
    elif res == "MAL_ECRIT":
        m = "BF-MedVerify: Code mal ecrit (11 caracteres, commence par BF). Relisez-le et renvoyez-le."
    else:  # INCONNU
        m = (
            "BF-MedVerify: CODE NON RECONNU. Verifiez les 11 caracteres. Si le code est exact, "
            "ne prenez pas ce produit, rapportez-le a la pharmacie."
        )
    return sans_accents(m)


def traiter(
    code: str,
    telephone: str,
    canal: str,
    db: Session | None = None,
    background_tasks: BackgroundTasks | None = None,
    expediteur_passerelle: str | None = None,
    envoyer_reponse_sms: bool = False,
    request_id: str | None = None,
) -> dict:
    tel = normaliser_numero(telephone)
    c = normaliser(code)

    if not bien_forme(c):  # faute de frappe : pas un faux !
        r = {"resultat": "MAL_ECRIT"}
    else:
        code_h = empreinte("code", c)
        tel_h = empreinte("phone", tel)

        if db is None:
            with SessionLocal() as session:
                r = verifier_code(session, code_h, tel_h, canal)
        else:
            r = verifier_code(db, code_h, tel_h, canal)

        if r.get("alerte"):
            alerte_ascii = sans_accents(r["alerte"])
            print("ALERTE A TRANSMETTRE A LA FASO FDA :", alerte_ascii)
            if background_tasks is not None:
                background_tasks.add_task(
                    envoyer_alerte_fda_sms, alerte_ascii, expediteur_passerelle
                )
            else:
                envoyer_alerte_fda_sms(alerte_ascii, expediteur_passerelle)

    message = fabriquer_message(r)

    if envoyer_reponse_sms and tel:
        if background_tasks is not None:
            background_tasks.add_task(
                envoyer_sms_httpsms,
                destinataire=tel,
                contenu=message,
                expediteur=expediteur_passerelle,
                request_id=request_id,
            )
        else:
            envoyer_sms_httpsms(
                destinataire=tel,
                contenu=message,
                expediteur=expediteur_passerelle,
                request_id=request_id,
            )

    return {"resultat": r["resultat"], "message": message}


def verifier_cle(cle: str) -> None:
    cle_attendue = get_api_key() or API_KEY
    if not cle_attendue or not hmac.compare_digest(cle, cle_attendue):
        raise HTTPException(status_code=403, detail="cle invalide")


class Demande(BaseModel):
    code: str
    telephone: str = "+22600000000"
    canal: str = "SMS"
    envoyer_sms: bool = False  # mettre a true pour expedier aussi la reponse par httpSMS


class SmsEntrant(BaseModel):
    expediteur: str  # numero de l'utilisateur
    texte: str       # ex : "VERIF BF8X2K..."


class HttpSmsDonnees(BaseModel):
    message_id: str | None = None
    user_id: str | None = None
    owner: str | None = None    # numero du telephone Android passerelle (SIM qui recoit)
    contact: str | None = None  # numero du client qui a envoye le SMS
    content: str | None = None  # texte du SMS entrant
    sim: str | None = None
    timestamp: str | None = None


class HttpSmsEvenement(BaseModel):
    id: str | None = None
    type: str
    source: str | None = None
    specversion: str | None = "1.0"
    datacontenttype: str | None = "application/json"
    time: str | None = None
    data: HttpSmsDonnees = HttpSmsDonnees()


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.scalars(select(Produit.id_produit).limit(1)).first()
    return {
        "statut": "ok",
        "environnement": get_app_env(),
        "httpsms_actif": is_httpsms_enabled(),
        "httpsms_diagnostic": diagnostic_httpsms(),
    }


@app.post("/verifier")  # pour tester dans /docs
def verifier(
    d: Demande,
    background_tasks: BackgroundTasks,
    cle: str = Query(...),
    db: Session = Depends(get_db),
):
    verifier_cle(cle)
    return traiter(
        d.code,
        d.telephone,
        d.canal,
        db,
        background_tasks=background_tasks,
        envoyer_reponse_sms=d.envoyer_sms,
    )


@app.post("/sms-entrant")  # passerelle SMS generique
def sms_entrant(
    sms: SmsEntrant,
    background_tasks: BackgroundTasks,
    cle: str = Query(...),
    db: Session = Depends(get_db),
):
    verifier_cle(cle)
    return traiter(
        sms.texte,
        sms.expediteur,
        "SMS",
        db,
        background_tasks=background_tasks,
        envoyer_reponse_sms=is_httpsms_enabled(),
    )


@app.post("/httpsms/webhook")  # webhook officiel CloudEvents de httpsms.com
def httpsms_webhook(
    evenement: HttpSmsEvenement,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    x_event_type: str | None = Header(default=None),
    cle: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    verifier_authentification_httpsms(authorization, cle)

    type_evt = (x_event_type or evenement.type).strip()
    if type_evt != "message.phone.received":
        return {"statut": "ignore", "type": type_evt}

    client_tel = normaliser_numero(evenement.data.contact or "")
    passerelle_tel = normaliser_numero(evenement.data.owner or "")
    if not client_tel:
        raise HTTPException(status_code=400, detail="Numero client (data.contact) manquant")

    # Evite toute boucle infinie si le telephone s'envoie un SMS a lui-meme
    if passerelle_tel and client_tel == passerelle_tel:
        return {"statut": "ignore", "raison": "auto_message"}

    rep = traiter(
        evenement.data.content or "",
        client_tel,
        "SMS",
        db,
        background_tasks=background_tasks,
        expediteur_passerelle=passerelle_tel or None,
        envoyer_reponse_sms=True,
        request_id=evenement.data.message_id,
    )
    return {
        "statut": "traite",
        "destinataire": client_tel,
        "expediteur": passerelle_tel,
        **rep,
    }
