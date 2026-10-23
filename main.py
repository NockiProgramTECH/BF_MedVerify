import hmac, os, unicodedata
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()
from bf_codes import normaliser, bien_forme, empreinte

URL, KEY = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
if URL and KEY:
    from supabase import create_client
    supabase = create_client(URL, KEY)          # cle service_role : secrete
else:
    supabase = None 

                            # (les tests injectent leur propre client)
API_KEY = os.getenv("API_KEY", "")              # cle secrete de l'API (dans l'URL du webhook)
app = FastAPI(title="BF-MedVerify")

def sans_accents(t: str) -> str:                # un accent = SMS en Unicode = 70 caracteres seulement
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()

def mmaa(iso: str) -> str:                      # '2028-03-31' -> '03/28'
    return f"{iso[5:7]}/{iso[2:4]}"

def fabriquer_message(r: dict) -> str:          # SMS court : 160 caracteres maximum
    res = r["resultat"]
    if res == "VRAI":
        m = (f"BF-MedVerify: AUTHENTIQUE. {r['produit']} {r['dosage']}, lot {r['lot']}, "
             f"exp {mmaa(r['expiration'])}. Comparez avec la boite. Si la maladie continue, consultez.")
    elif res == "DEJA_UTILISE":
        d = r["date_premiere"]
        m = (f"BF-MedVerify: ATTENTION. Code deja verifie le {d[8:10]}/{d[5:7]}. Si ce n'est pas vous, "
             "copie possible: ne prenez pas ce produit, rapportez-le a la pharmacie.")
    elif res == "EXPIRE":
        m = f"BF-MedVerify: ATTENTION. Medicament expire ({mmaa(r['expiration'])}). Ne le prenez pas. Rapportez-le a la pharmacie."
    elif res == "REVOQUE":
        m = "BF-MedVerify: ATTENTION. Ce lot est signale (rappel ou suspicion). Ne le prenez pas. Rapportez-le a la pharmacie."
    elif res == "LIMITE":
        m = "BF-MedVerify: Trop de demandes. Attendez 1 minute puis reessayez."
    elif res == "MAL_ECRIT":
        m = "BF-MedVerify: Code mal ecrit (11 caracteres, commence par BF). Relisez-le et renvoyez-le."
    else:                                        # INCONNU
        m = ("BF-MedVerify: CODE NON RECONNU. Verifiez les 11 caracteres. Si le code est exact, "
             "ne prenez pas ce produit, rapportez-le a la pharmacie.")
    return sans_accents(m)

def traiter(code: str, telephone: str, canal: str) -> dict:
    c = normaliser(code)
    if not bien_forme(c):                        # faute de frappe : pas un faux !
        return {"resultat": "MAL_ECRIT", "message": fabriquer_message({"resultat": "MAL_ECRIT"})}
    tel = "".join(ch for ch in telephone if ch.isdigit() or ch == "+")
    rep = supabase.rpc("verifier_code", {"p_code_hash": empreinte("code", c),
                                         "p_tel_hash": empreinte("phone", tel),
                                         "p_canal": canal}).execute()
    r = rep.data
    if r.get("alerte"):                          # a brancher sur l'envoi de SMS (bloc 4.3)
        print("ALERTE A TRANSMETTRE A LA FASO FDA :", r["alerte"])
    return {"resultat": r["resultat"], "message": fabriquer_message(r)}

def verifier_cle(cle: str):
    if not API_KEY or not hmac.compare_digest(cle, API_KEY):
        raise HTTPException(status_code=403, detail="cle invalide")

class Demande(BaseModel):
    code: str
    telephone: str = "+22600000000"
    canal: str = "SMS"

class SmsEntrant(BaseModel):
    expediteur: str                              # numero de l'utilisateur
    texte: str                                   # ex : "VERIF BF8X2K..."

@app.post("/verifier")                           # pour tester dans /docs
def verifier(d: Demande, cle: str = Query(...)):
    verifier_cle(cle)
    return traiter(d.code, d.telephone, d.canal)

@app.post("/sms-entrant")                        # appelee par la passerelle SMS
def sms_entrant(sms: SmsEntrant, cle: str = Query(...)):
    verifier_cle(cle)
    return traiter(sms.texte, sms.expediteur, "SMS")
