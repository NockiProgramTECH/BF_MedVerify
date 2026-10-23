"""Client d'envoi de SMS et authentification des webhooks httpSMS (https://docs.httpsms.com).

Architecture httpSMS :
1. Sur le telephone Android : installer l'app httpSMS et se connecter avec une **Phone API Key**
   creee sur https://httpsms.com/phone-api-keys (permet au telephone de recevoir/envoyer les SMS).
2. Sur ce serveur FastAPI : utiliser la **cle API du compte** (`HTTPSMS_API_KEY`, depuis
   https://httpsms.com/settings) dans l'en-tete `x-api-key` vers `POST /v1/messages/send`
   afin d'envoyer la reponse SMS au citoyen.
3. Lorsqu'un citoyen envoie un SMS au telephone Android, httpSMS notifie `POST /httpsms/webhook`
   avec un jeton JWT Bearer signe en HS256 via `HTTPSMS_WEBHOOK_SIGNING_KEY`.
"""
import hmac
from typing import Any

from fastapi import HTTPException
import httpx
import jwt

from config import (
    diagnostic_httpsms,
    get_api_key,
    get_httpsms_alert_to,
    get_httpsms_api_key,
    get_httpsms_api_url,
    get_httpsms_from_number,
    get_httpsms_timeout,
    get_httpsms_webhook_signing_key,
    is_httpsms_enabled,
)


def normaliser_numero(telephone: str) -> str:
    """Conserve uniquement le signe '+' et les chiffres d'un numero de telephone."""
    return "".join(ch for ch in telephone if ch.isdigit() or ch == "+")


def envoyer_sms_httpsms(
    destinataire: str,
    contenu: str,
    expediteur: str | None = None,
    request_id: str | None = None,
    transport: httpx.BaseTransport | None = None,
) -> dict[str, Any]:
    """Envoie un SMS de reponse au client via l'API httpSMS (`POST /v1/messages/send`).

    En mode simulation (`is_httpsms_enabled() == False`), n'effectue aucun appel reseau
    et journalise le SMS qui aurait ete envoye.
    """
    numero_to = normaliser_numero(destinataire)
    numero_from = normaliser_numero(expediteur or get_httpsms_from_number())

    if not numero_to:
        return {"envoye": False, "erreur": "destinataire manquant"}

    if not is_httpsms_enabled():
        raison = diagnostic_httpsms()
        print(
            f"[HTTPSMS SIMULATION | {raison}] {numero_from or 'PASSERELLE'} -> {numero_to} : {contenu}",
            flush=True,
        )
        return {
            "envoye": False,
            "mode": "simulation",
            "raison": raison,
            "from": numero_from,
            "to": numero_to,
            "content": contenu,
        }

    api_key = get_httpsms_api_key()
    if not api_key:
        print("ERREUR HTTPSMS : HTTPSMS_API_KEY manquante alors que HTTPSMS_ENABLED=true")
        return {"envoye": False, "erreur": "HTTPSMS_API_KEY manquante"}

    if not numero_from:
        print("ERREUR HTTPSMS : numero expediteur (HTTPSMS_FROM_NUMBER ou owner) manquant")
        return {"envoye": False, "erreur": "numero expediteur (from) manquant"}

    payload: dict[str, Any] = {
        "from": numero_from,
        "to": numero_to,
        "content": contenu,
        "encrypted": False,
    }
    if request_id:
        payload["request_id"] = request_id

    headers = {
        "x-api-key": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=get_httpsms_timeout(), transport=transport) as client:
            rep = client.post(get_httpsms_api_url(), headers=headers, json=payload)

        corps = (
            rep.json()
            if rep.headers.get("content-type", "").startswith("application/json")
            else {}
        )
        if 200 <= rep.status_code < 300:
            donnees = corps.get("data") if isinstance(corps, dict) else None
            id_msg = donnees.get("id") if isinstance(donnees, dict) else None
            print(
                f"[HTTPSMS ENVOI OK] {numero_from} -> {numero_to} (id={id_msg})",
                flush=True,
            )
            return {
                "envoye": True,
                "statut_http": rep.status_code,
                "id_message": id_msg,
                "from": numero_from,
                "to": numero_to,
            }

        print(f"ERREUR HTTPSMS ({rep.status_code}) : {rep.text[:300]}", flush=True)
        return {
            "envoye": False,
            "statut_http": rep.status_code,
            "erreur": rep.text[:300],
        }
    except httpx.HTTPError as exc:
        print(f"ERREUR RESEAU HTTPSMS : {exc}")
        return {"envoye": False, "erreur": str(exc)}


def envoyer_alerte_fda_sms(
    texte_alerte: str,
    expediteur: str | None = None,
    transport: httpx.BaseTransport | None = None,
) -> dict[str, Any] | None:
    """Transmet par SMS une alerte sanitaire a `HTTPSMS_ALERT_TO` si ce numero est configure."""
    dest_alerte = normaliser_numero(get_httpsms_alert_to())
    if not dest_alerte:
        return None
    message = f"BF-MedVerify ALERTE FDA: {texte_alerte}"[:160]
    return envoyer_sms_httpsms(
        destinataire=dest_alerte,
        contenu=message,
        expediteur=expediteur,
        transport=transport,
    )


def verifier_authentification_httpsms(
    authorization: str | None,
    cle_query: str | None = None,
) -> dict[str, Any]:
    """Authentifie un webhook entrant httpSMS.

    - Priorite 1 : si `HTTPSMS_WEBHOOK_SIGNING_KEY` est configuree, verifie le jeton
      `Authorization: Bearer <JWT>` signe en HS256 par httpSMS.
    - Priorite 2 (secours / tests locaux) : si `HTTPSMS_WEBHOOK_SIGNING_KEY` n'est pas
      definie, accepte `?cle=<API_KEY>` comparee en temps constant.
    """
    signing_key = get_httpsms_webhook_signing_key()
    if signing_key:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="En-tete Authorization Bearer manquant pour le webhook httpSMS",
            )
        token = authorization[len("Bearer "):].strip()
        try:
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return claims if isinstance(claims, dict) else {}
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=401,
                detail="Jeton JWT httpSMS invalide",
            ) from exc

    cle_attendue = get_api_key()
    if cle_attendue and cle_query and hmac.compare_digest(cle_query, cle_attendue):
        return {"auth": "api_key"}

    raise HTTPException(
        status_code=401,
        detail="Authentification webhook requise (HTTPSMS_WEBHOOK_SIGNING_KEY ou ?cle=...)",
    )
