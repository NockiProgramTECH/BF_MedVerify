"""API FastAPI BF-MedVerify utilisant SQLAlchemy ORM et pilotee par APP_ENV."""
from contextlib import asynccontextmanager
import hmac
import unicodedata

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from bf_codes import bien_forme, empreinte, normaliser
from config import get_api_key, get_app_env, get_auto_init_db
from database import SessionLocal, get_db
from init_db import initialiser_base
from models import Produit
from services import verifier_code

API_KEY = get_api_key()  # cle secrete de l'API (dans l'URL du webhook : ?cle=...)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_auto_init_db():
        initialiser_base()
    yield


app = FastAPI(title="BF-MedVerify", lifespan=lifespan)


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
) -> dict:
    c = normaliser(code)
    if not bien_forme(c):  # faute de frappe : pas un faux !
        return {
            "resultat": "MAL_ECRIT",
            "message": fabriquer_message({"resultat": "MAL_ECRIT"}),
        }

    tel = "".join(ch for ch in telephone if ch.isdigit() or ch == "+")
    code_h = empreinte("code", c)
    tel_h = empreinte("phone", tel)

    if db is None:
        with SessionLocal() as session:
            r = verifier_code(session, code_h, tel_h, canal)
    else:
        r = verifier_code(db, code_h, tel_h, canal)

    if r.get("alerte"):  # a brancher sur l'envoi de SMS (bloc 4.3)
        print("ALERTE A TRANSMETTRE A LA FASO FDA :", r["alerte"])
    return {"resultat": r["resultat"], "message": fabriquer_message(r)}


def verifier_cle(cle: str) -> None:
    cle_attendue = get_api_key() or API_KEY
    if not cle_attendue or not hmac.compare_digest(cle, cle_attendue):
        raise HTTPException(status_code=403, detail="cle invalide")


class Demande(BaseModel):
    code: str
    telephone: str = "+22600000000"
    canal: str = "SMS"


class SmsEntrant(BaseModel):
    expediteur: str  # numero de l'utilisateur
    texte: str       # ex : "VERIF BF8X2K..."


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.scalars(select(Produit.id_produit).limit(1)).first()
    return {"statut": "ok", "environnement": get_app_env()}


@app.post("/verifier")  # pour tester dans /docs
def verifier(
    d: Demande,
    cle: str = Query(...),
    db: Session = Depends(get_db),
):
    verifier_cle(cle)
    return traiter(d.code, d.telephone, d.canal, db)


@app.post("/sms-entrant")  # appelee par la passerelle SMS
def sms_entrant(
    sms: SmsEntrant,
    cle: str = Query(...),
    db: Session = Depends(get_db),
):
    verifier_cle(cle)
    return traiter(sms.texte, sms.expediteur, "SMS", db)
