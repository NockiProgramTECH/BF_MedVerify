"""Logique metier de verification des codes via SQLAlchemy ORM (sans SQL brut)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from models import Alerte, CodeSecurite, Lot, Verification


def verifier_code(
    db: Session,
    p_code_hash: str,
    p_tel_hash: str,
    p_canal: str = "SMS",
) -> dict:
    """Verifie l'empreinte d'un code et d'un telephone via l'ORM SQLAlchemy.

    Ne recoit et ne stocke que des empreintes HMAC-SHA256, jamais le code
    ni le numero de telephone en clair.
    """
    maintenant = datetime.now(timezone.utc)
    aujourd_hui = maintenant.date()

    # 1) Anti-spam : maximum 5 demandes par minute et par telephone
    un_min_avant = maintenant - timedelta(minutes=1)
    nb_demandes_minute = (
        db.scalar(
            select(func.count(Verification.id_verification)).where(
                Verification.tel_hash == p_tel_hash,
                Verification.date_heure > un_min_avant,
            )
        )
        or 0
    )
    if nb_demandes_minute >= 5:
        db.add(
            Verification(
                code_hash=p_code_hash,
                tel_hash=p_tel_hash,
                canal=p_canal,
                resultat="LIMITE",
                date_heure=maintenant,
            )
        )
        db.commit()
        return {"resultat": "LIMITE"}

    # 2) Recherche du code avec verrouillage de ligne (FOR UPDATE) :
    #    si plusieurs telephones envoient le meme code au meme instant,
    #    un seul peut obtenir "VRAI".
    cs = db.scalars(
        select(CodeSecurite)
        .options(selectinload(CodeSecurite.lot).selectinload(Lot.produit))
        .where(CodeSecurite.code_hash == p_code_hash)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()

    # Cas d'un code bien forme mais absent de la base
    if cs is None:
        db.add(
            Verification(
                id_code=None,
                code_hash=p_code_hash,
                tel_hash=p_tel_hash,
                canal=p_canal,
                resultat="INCONNU",
                date_heure=maintenant,
            )
        )
        db.flush()

        vingt_quatre_h_avant = maintenant - timedelta(hours=24)
        nb_inconnus = (
            db.scalar(
                select(func.count(Verification.id_verification)).where(
                    Verification.resultat == "INCONNU",
                    Verification.date_heure > vingt_quatre_h_avant,
                )
            )
            or 0
        )

        alerte_msg = None
        if nb_inconnus >= 3:
            alerte_existante = db.scalars(
                select(Alerte).where(
                    Alerte.type == "CODES_INCONNUS",
                    Alerte.date_heure > vingt_quatre_h_avant,
                )
            ).first()
            if alerte_existante is None:
                alerte_msg = f"{nb_inconnus} codes inconnus en 24 h"
                db.add(
                    Alerte(
                        type="CODES_INCONNUS",
                        detail=alerte_msg,
                        date_heure=maintenant,
                    )
                )

        db.commit()
        return {"resultat": "INCONNU", "alerte": alerte_msg}

    lot = cs.lot
    produit = lot.produit

    if cs.statut == "REVOQUE" or lot.statut == "RAPPELE":
        resultat = "REVOQUE"
    elif lot.date_expiration < aujourd_hui:
        resultat = "EXPIRE"
    elif cs.statut == "NON_UTILISE":
        cs.statut = "UTILISE"
        cs.date_premiere_verification = maintenant
        cs.premier_tel_hash = p_tel_hash
        resultat = "VRAI"
    elif cs.premier_tel_hash == p_tel_hash:
        resultat = "VRAI"
    else:
        resultat = "DEJA_UTILISE"

    db.add(
        Verification(
            id_code=cs.id_code,
            code_hash=p_code_hash,
            tel_hash=p_tel_hash,
            canal=p_canal,
            resultat=resultat,
            date_heure=maintenant,
        )
    )
    db.flush()

    # 3) Alerte : un meme code verifie par au moins 3 telephones differents
    alerte_msg = None
    if resultat == "DEJA_UTILISE":
        nb_tels = (
            db.scalar(
                select(func.count(func.distinct(Verification.tel_hash))).where(
                    Verification.id_code == cs.id_code,
                    Verification.resultat.in_(["VRAI", "DEJA_UTILISE"]),
                )
            )
            or 0
        )
        if nb_tels >= 3:
            alerte_existante = db.scalars(
                select(Alerte).where(
                    Alerte.type == "CODE_COPIE_PROBABLE",
                    Alerte.id_code == cs.id_code,
                )
            ).first()
            if alerte_existante is None:
                alerte_msg = f"{nb_tels} telephones differents"
                db.add(
                    Alerte(
                        type="CODE_COPIE_PROBABLE",
                        id_code=cs.id_code,
                        detail=alerte_msg,
                        date_heure=maintenant,
                    )
                )

    date_premiere_iso = (
        cs.date_premiere_verification.isoformat()
        if cs.date_premiere_verification is not None
        else None
    )
    reponse = {
        "resultat": resultat,
        "produit": produit.nom,
        "dosage": produit.dosage,
        "lot": lot.numero_lot,
        "expiration": lot.date_expiration.isoformat(),
        "date_premiere": date_premiere_iso,
        "alerte": alerte_msg,
    }

    db.commit()
    return reponse
