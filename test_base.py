"""Tests automatiques de recette (SQLAlchemy ORM + PostgreSQL).

ATTENTION : ce script reinitialise les tables de la base locale de test.
Il refuse de s'executer si APP_ENV=online afin de proteger toute base distante.
"""
import concurrent.futures as cf
import os
import sys

# Protection : interdiction formelle de lancer la suite destructive en mode online
if os.environ.get("APP_ENV", "local").strip().lower() in ("online", "prod", "production", "en_ligne"):
    sys.exit("SECURITE : test_base.py vide les tables et ne doit etre lance qu'avec APP_ENV=local.")

os.environ["APP_ENV"] = "local"
os.environ.setdefault("BFMV_PEPPER", "pepper-de-test")
os.environ["API_KEY"] = "cle-test"

from fastapi.testclient import TestClient
from sqlalchemy import func, or_, select

import bf_codes as B
import config as C
from database import SessionLocal, get_engine
from init_db import charger_donnees_test
import main as M
from models import Alerte, Base, CodeSecurite, Lot, Verification


def ok(nom: str, cond: bool) -> None:
    print(("OK   " if cond else "ECHEC"), nom)


def verifie(nom: str, cond: bool) -> None:
    ok(nom, cond)
    if not cond:
        sys.exit(1)


# --- Tests de pilotage par variable d'environnement (APP_ENV : local vs online) ---
sauvegarde_env = dict(os.environ)
try:
    os.environ["APP_ENV"] = "local"
    os.environ.pop("LOCAL_DATABASE_URL", None)
    os.environ["POSTGRES_HOST"] = "localhost"
    os.environ["POSTGRES_PORT"] = "5432"
    os.environ["POSTGRES_USER"] = "bfmv"
    os.environ["POSTGRES_PASSWORD"] = "bfmv"
    os.environ["POSTGRES_DB"] = "bfmv"
    os.environ["DATABASE_URL"] = "postgres://distant:secret@db.exemple.org:5432/prod_db"
    url_locale = C.get_database_url()
    verifie(
        "0a APP_ENV=local utilise le serveur PostgreSQL local (ignore DATABASE_URL distant)",
        url_locale == "postgresql+psycopg2://bfmv:bfmv@localhost:5432/bfmv",
    )

    os.environ["APP_ENV"] = "online"
    url_online = C.get_database_url()
    verifie(
        "0b APP_ENV=online utilise DATABASE_URL generique (normalise postgres://)",
        url_online == "postgresql+psycopg2://distant:secret@db.exemple.org:5432/prod_db",
    )

    os.environ.pop("DATABASE_URL", None)
    erreur_sans_url = False
    try:
        C.get_database_url()
    except RuntimeError:
        erreur_sans_url = True
    verifie(
        "0c APP_ENV=online sans DATABASE_URL leve une erreur explicite",
        erreur_sans_url,
    )
finally:
    os.environ.clear()
    os.environ.update(sauvegarde_env)

# --- Preparation de la base PostgreSQL locale via SQLAlchemy ORM uniquement ---
engine = get_engine()
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    lots_demo = charger_donnees_test(db)
    # 100 codes de demo : 90 sur lots actifs 1-3, 10 sur le lot 4 (expire)
    codes: list[str] = []
    objets_codes: list[CodeSecurite] = []
    for i in range(100):
        c = B.nouveau_code()
        codes.append(c)
        lot_cible = lots_demo[3] if i >= 90 else lots_demo[i % 3]
        objets_codes.append(
            CodeSecurite(id_lot=lot_cible.id_lot, code_hash=B.empreinte("code", c))
        )
    db.add_all(objets_codes)
    db.commit()
    id_lot_2 = lots_demo[1].id_lot

with TestClient(M.app) as cl:

    def sms(tel: str, texte: str) -> dict:
        r = cl.post("/sms-entrant?cle=cle-test", json={"expediteur": tel, "texte": texte})
        assert r.status_code == 200, r.text
        return r.json()

    lot13 = [c for i, c in enumerate(codes) if i < 90]
    lot4 = codes[90]

    verifie(
        "1 code valide, 1er telephone -> VRAI",
        sms("+22670000001", "VERIF " + lot13[0])["resultat"] == "VRAI",
    )
    verifie(
        "2 meme telephone, minuscules -> VRAI (pas d'alarme)",
        sms("+22670000001", lot13[0].lower())["resultat"] == "VRAI",
    )
    verifie(
        "3 autre telephone -> DEJA_UTILISE",
        sms("+22670000002", lot13[0])["resultat"] == "DEJA_UTILISE",
    )
    sms("+22670000003", lot13[0])

    with SessionLocal() as db:
        alertes = db.scalars(select(Alerte)).all()
    verifie(
        "4 3 telephones differents -> 1 alerte CODE_COPIE_PROBABLE",
        len(alertes) == 1 and alertes[0].type == "CODE_COPIE_PROBABLE",
    )

    typo = lot13[1][:5] + ("A" if lot13[1][5] != "A" else "B") + lot13[1][6:]
    verifie(
        "5 faute de frappe -> MAL_ECRIT (rien en base)",
        sms("+22670000010", typo)["resultat"] == "MAL_ECRIT",
    )

    def inconnu() -> str:
        b = "BF" + "".join(B.secrets.choice(B.ALPHABET) for _ in range(8))
        return b + B.caractere_controle(b)

    for i in range(3):
        r = sms(f"+2267000002{i}", inconnu())

    with SessionLocal() as db:
        nb_alertes = (
            db.scalar(
                select(func.count(Alerte.id_alerte)).where(
                    Alerte.type == "CODES_INCONNUS"
                )
            )
            or 0
        )
    verifie(
        "6 code inconnu -> INCONNU, et 3 inconnus -> alerte CODES_INCONNUS",
        r["resultat"] == "INCONNU" and nb_alertes == 1,
    )

    verifie(
        "7 code du lot expire -> EXPIRE",
        sms("+22670000030", lot4)["resultat"] == "EXPIRE",
    )

    with SessionLocal() as db:
        lot_a_rappeler = db.get(Lot, id_lot_2)
        assert lot_a_rappeler is not None
        lot_a_rappeler.statut = "RAPPELE"
        db.commit()

    c2 = [c for i, c in enumerate(codes[:90]) if i % 3 == 1][0]
    verifie(
        "8 lot rappele -> REVOQUE",
        sms("+22670000031", c2)["resultat"] == "REVOQUE",
    )

    for i in range(6):
        r = sms("+22670000040", lot13[2 + i])
    verifie("9 6 demandes en 1 minute -> LIMITE", r["resultat"] == "LIMITE")

    cible = [c for i, c in enumerate(codes[:90]) if i % 3 == 2][5]
    with cf.ThreadPoolExecutor(20) as ex:
        res = list(
            ex.map(
                lambda i: sms(f"+226700001{i:02d}", cible)["resultat"],
                range(20),
            )
        )
    verifie(
        f"10 20 telephones en meme temps : VRAI = {res.count('VRAI')} sur 20 (attendu 1)",
        res.count("VRAI") == 1,
    )

    verifie(
        "11 mauvaise cle -> 403",
        cl.post(
            "/sms-entrant?cle=mauvaise",
            json={"expediteur": "+1", "texte": "x"},
        ).status_code
        == 403,
    )

    with SessionLocal() as db:
        nb_en_clair = (
            db.scalar(
                select(func.count(Verification.id_verification)).where(
                    or_(
                        Verification.tel_hash.like("+%"),
                        Verification.code_hash.like("BF%"),
                    )
                )
            )
            or 0
        )
    verifie("12 aucun numero ni code en clair en base", nb_en_clair == 0)

    exemples = [
        {
            "resultat": "VRAI",
            "produit": "Artemether-Lumefantrine-Test",
            "dosage": "20/120 mg",
            "lot": "L24C09",
            "expiration": "2027-12-31",
        },
        {"resultat": "DEJA_UTILISE", "date_premiere": "2026-10-12T10:32:00+00:00"},
        {"resultat": "INCONNU"},
        {"resultat": "MAL_ECRIT"},
        {"resultat": "LIMITE"},
        {"resultat": "EXPIRE", "expiration": "2025-12-31"},
        {"resultat": "REVOQUE"},
    ]
    longueurs = [len(M.fabriquer_message(e)) for e in exemples]
    verifie(
        f"13 messages <= 160 caracteres, ASCII : {longueurs}",
        max(longueurs) <= 160 and all(M.fabriquer_message(e).isascii() for e in exemples),
    )

    acc = M.fabriquer_message(
        {
            "resultat": "VRAI",
            "produit": "Paracétamol",
            "dosage": "500 mg",
            "lot": "L1",
            "expiration": "2028-03-31",
        }
    )
    verifie(
        "14 les accents sont retires (Paracetamol)",
        "Paracetamol" in acc and acc.isascii(),
    )

    sante = cl.get("/health")
    verifie(
        "15 endpoint /health fonctionnel et indique l'environnement",
        sante.status_code == 200 and sante.json() == {"statut": "ok", "environnement": "local"},
    )

    doc_html = cl.get("/docs")
    doc_js = cl.get("/static-offline-docs/swagger-ui-bundle.js")
    doc_css = cl.get("/static-offline-docs/swagger-ui.css")
    verifie(
        "16 Swagger UI embarque en local (sans CDN externe, JS/CSS servis en 200 OK)",
        doc_html.status_code == 200
        and "cdn.jsdelivr.net" not in doc_html.text
        and doc_js.status_code == 200
        and "javascript" in doc_js.headers.get("content-type", "")
        and doc_css.status_code == 200
        and "text/css" in doc_css.headers.get("content-type", ""),
    )

print("TOUS LES TESTS PASSENT")
