"""Initialisation des tables et chargement des donnees de demonstration via SQLAlchemy ORM.

Usage :
  python init_db.py         -> cree les tables dans la base active (selon APP_ENV)
  python init_db.py demo    -> cree les tables + insere les produits et lots de test
"""
from datetime import date
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_app_env
from database import SessionLocal, get_engine
from models import Base, Lot, Produit

PRODUITS_DEMO = [
    {
        "nom": "Paracetamol-Test",
        "dci": "Paracetamol",
        "laboratoire": "LABO-TEST-A",
        "titulaire_amm": "LABO-TEST-A",
        "code_amm": "TEST-0001",
        "dosage": "500 mg",
        "forme": "Comprime",
    },
    {
        "nom": "Amoxicilline-Test",
        "dci": "Amoxicilline",
        "laboratoire": "LABO-TEST-B",
        "titulaire_amm": "LABO-TEST-B",
        "code_amm": "TEST-0002",
        "dosage": "500 mg",
        "forme": "Gelule",
    },
    {
        "nom": "Artemether-Lumefantrine-Test",
        "dci": "Artemether-Lumefantrine",
        "laboratoire": "LABO-TEST-C",
        "titulaire_amm": "LABO-TEST-C",
        "code_amm": "TEST-0003",
        "dosage": "20/120 mg",
        "forme": "Comprime",
    },
]

LOTS_DEMO = [
    {
        "code_amm": "TEST-0001",
        "numero_lot": "L24A17",
        "date_fabrication": date(2026, 1, 15),
        "date_expiration": date(2028, 3, 31),
    },
    {
        "code_amm": "TEST-0002",
        "numero_lot": "L24B02",
        "date_fabrication": date(2026, 2, 10),
        "date_expiration": date(2028, 2, 28),
    },
    {
        "code_amm": "TEST-0003",
        "numero_lot": "L24C09",
        "date_fabrication": date(2026, 3, 5),
        "date_expiration": date(2027, 12, 31),
    },
    {
        "code_amm": "TEST-0001",
        "numero_lot": "L23Z99",
        "date_fabrication": date(2024, 1, 10),
        "date_expiration": date(2025, 12, 31),  # lot deja expire, pour tester
    },
]


def initialiser_base() -> None:
    """Cree toutes les tables et index via SQLAlchemy ORM s'ils n'existent pas encore."""
    Base.metadata.create_all(bind=get_engine())


def charger_donnees_test(db: Session) -> list[Lot]:
    """Insere (de facon idempotente) les produits et lots de test via l'ORM."""
    produits_par_amm: dict[str, Produit] = {}
    for p_data in PRODUITS_DEMO:
        existant = db.scalars(
            select(Produit).where(Produit.code_amm == p_data["code_amm"])
        ).first()
        if existant is None:
            existant = Produit(**p_data)
            db.add(existant)
            db.flush()
        produits_par_amm[p_data["code_amm"]] = existant

    lots_crees: list[Lot] = []
    for l_data in LOTS_DEMO:
        produit = produits_par_amm[l_data["code_amm"]]
        lot = db.scalars(
            select(Lot).where(
                Lot.id_produit == produit.id_produit,
                Lot.numero_lot == l_data["numero_lot"],
            )
        ).first()
        if lot is None:
            lot = Lot(
                id_produit=produit.id_produit,
                numero_lot=l_data["numero_lot"],
                date_fabrication=l_data["date_fabrication"],
                date_expiration=l_data["date_expiration"],
            )
            db.add(lot)
            db.flush()
        lots_crees.append(lot)

    db.commit()
    return lots_crees


if __name__ == "__main__":
    env = get_app_env()
    initialiser_base()
    if len(sys.argv) >= 2 and sys.argv[1] == "demo":
        with SessionLocal() as session:
            lots = charger_donnees_test(session)
        print(
            f"OK [{env}] : tables creees et {len(lots)} lots de demonstration charges via SQLAlchemy ORM."
        )
    elif len(sys.argv) == 1:
        print(f"OK [{env}] : tables creees via SQLAlchemy ORM.")
    else:
        sys.exit(__doc__)
