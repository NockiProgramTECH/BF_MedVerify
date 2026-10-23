"""Outils communs : fabrication, controle et empreinte des codes BF-MedVerify."""
import hashlib, hmac, os, re, secrets

# 31 caracteres : pas de 0, O, 1, I, L (faciles a confondre)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
# Secret du serveur. A garder SEPAREMENT et ne JAMAIS changer : sans lui, tous les codes deviennent illisibles.
PEPPER = os.environ.get("BFMV_PEPPER", "").encode()

def caractere_controle(corps: str) -> str:
    """Un caractere calcule a partir des autres : il detecte toute faute de frappe isolee
    et l'inversion de deux caracteres voisins."""
    return ALPHABET[sum((i + 1) * ALPHABET.index(c) for i, c in enumerate(corps)) % 31]

def nouveau_code() -> str:
    """'BF' + 8 caracteres au hasard (39,6 bits) + 1 caractere de controle = 11 caracteres."""
    corps = "BF" + "".join(secrets.choice(ALPHABET) for _ in range(8))
    return corps + caractere_controle(corps)

def normaliser(texte: str) -> str:
    """Majuscules, sans espaces ni tirets ; accepte 'VERIF BF...'."""
    t = re.sub(r"[^A-Za-z0-9]", "", texte).upper()
    return t[5:] if t.startswith("VERIF") else t

def bien_forme(code: str) -> bool:
    return (len(code) == 11 and code.startswith("BF")
            and all(c in ALPHABET for c in code)
            and caractere_controle(code[:-1]) == code[-1])

def empreinte(sorte: str, valeur: str) -> str:
    """Empreinte HMAC-SHA256 : on stocke ca, jamais le code ni le numero de telephone."""
    if not PEPPER:
        raise RuntimeError("BFMV_PEPPER manquant dans le fichier .env")
    return hmac.new(PEPPER, f"{sorte}:{valeur}".encode(), hashlib.sha256).hexdigest()
