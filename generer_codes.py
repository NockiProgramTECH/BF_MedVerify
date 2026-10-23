"""Genere des codes et enregistre leurs empreintes directement en base via SQLAlchemy ORM.

Usage :
   python generer_codes.py demo          -> 100 codes de demonstration (lots de demo 1 a 4)
   python generer_codes.py lot 7 500     -> 500 codes pour le lot numero 7
   python generer_codes.py inconnus 5    -> 5 codes BIEN FORMES mais absents de la base (faux codes de test)
"""
import sys

from bf_codes import empreinte, nouveau_code
from config import get_app_env
from database import SessionLocal
from init_db import charger_donnees_test, initialiser_base
from models import CodeSecurite, Lot


def choisir(n: int) -> list[str]:
    codes: set[str] = set()
    while len(codes) < n:          # set = pas de doublons
        codes.add(nouveau_code())
    return sorted(codes)


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "inconnus":
        print("\n".join(choisir(int(sys.argv[2]))))   # rien n'est enregistre en base
        return

    env = get_app_env()
    initialiser_base()

    with SessionLocal() as db:
        if len(sys.argv) >= 2 and sys.argv[1] == "demo":
            lots_demo = charger_donnees_test(db)
            codes = choisir(100)
            # 90 codes sur les 3 premiers lots actifs, 10 codes sur le 4e lot (expire)
            ids_lots = [
                lots_demo[3].id_lot if i >= 90 else lots_demo[i % 3].id_lot
                for i in range(100)
            ]
        elif len(sys.argv) == 4 and sys.argv[1] == "lot":
            id_lot = int(sys.argv[2])
            nb_codes = int(sys.argv[3])
            lot = db.get(Lot, id_lot)
            if lot is None:
                sys.exit(f"Erreur : aucun lot avec id_lot={id_lot} dans la base ({env}).")
            codes = choisir(nb_codes)
            ids_lots = [lot.id_lot] * len(codes)
        else:
            sys.exit(__doc__)

        objets_codes = [
            CodeSecurite(id_lot=id_lot, code_hash=empreinte("code", c))
            for id_lot, c in zip(ids_lots, codes)
        ]
        db.add_all(objets_codes)
        db.commit()

    with open("liste_codes.txt", "w", encoding="utf-8") as f:
        # SEUL endroit ou les codes apparaissent en clair
        f.write("\n".join(codes) + "\n")

    print(
        f"OK [{env}] : {len(codes)} empreintes enregistrees dans PostgreSQL via SQLAlchemy ORM. "
        "Imprimez liste_codes.txt puis detruisez-le."
    )


if __name__ == "__main__":
    main()
