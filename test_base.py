"""Tests de recette. A lancer UNIQUEMENT sur une base LOCALE de test (le script vide les tables).
   Prerequis : une base PostgreSQL locale vide, et DATABASE_URL = chaine de connexion locale."""
import os, sys, concurrent.futures as cf
os.environ.setdefault("BFMV_PEPPER", "pepper-de-test"); os.environ["API_KEY"] = "cle-test"
os.environ.pop("SUPABASE_URL", None); os.environ.pop("SUPABASE_KEY", None)
import psycopg2
from fastapi.testclient import TestClient
import bf_codes as B, main as M

DB = os.environ.get("DATABASE_URL", "postgresql://bfmv:bfmv@localhost/bfmv")
conn = psycopg2.connect(DB); conn.autocommit = True; cur = conn.cursor()
cur.execute("drop schema public cascade; create schema public; create extension if not exists pgcrypto;")
for f in ("sql/01_tables.sql", "sql/02_donnees_test.sql", "sql/03_verifier_code.sql"):
    cur.execute(open(f).read())

codes = []                                     # 100 codes de demo : 90 sur lots 1-3, 10 sur lot 4
for i in range(100):
    c = B.nouveau_code(); codes.append(c)
    cur.execute("insert into code_securite (id_lot, code_hash) values (%s,%s)",
                (4 if i >= 90 else (i % 3) + 1, B.empreinte("code", c)))

class FauxSupabase:                            # imite supabase.rpc(...).execute() avec la base locale
    def rpc(self, nom, params):
        c2 = psycopg2.connect(DB); c2.autocommit = True; k = c2.cursor()
        k.execute(f"select {nom}(%s,%s,%s)", (params["p_code_hash"], params["p_tel_hash"], params["p_canal"]))
        data = k.fetchone()[0]; c2.close()
        class R:
            def execute(s): return type("D", (), {"data": data})()
        return R()
M.supabase = FauxSupabase(); M.API_KEY = "cle-test"
cl = TestClient(M.app)
def sms(tel, texte):
    r = cl.post("/sms-entrant?cle=cle-test", json={"expediteur": tel, "texte": texte}); assert r.status_code == 200, r.text
    return r.json()
def ok(nom, cond): print(("OK   " if cond else "ECHEC"), nom)
def verifie(nom, cond):
    ok(nom, cond); 
    if not cond: sys.exit(1)

lot13 = [c for i, c in enumerate(codes) if i < 90]; lot4 = codes[90]
verifie("1 code valide, 1er telephone -> VRAI", sms("+22670000001", "VERIF " + lot13[0])["resultat"] == "VRAI")
verifie("2 meme telephone, minuscules -> VRAI (pas d'alarme)", sms("+22670000001", lot13[0].lower())["resultat"] == "VRAI")
verifie("3 autre telephone -> DEJA_UTILISE", sms("+22670000002", lot13[0])["resultat"] == "DEJA_UTILISE")
sms("+22670000003", lot13[0])
cur.execute("select type, detail from alerte"); al = cur.fetchall()
verifie("4 3 telephones differents -> 1 alerte CODE_COPIE_PROBABLE", len(al) == 1 and al[0][0] == "CODE_COPIE_PROBABLE")
typo = lot13[1][:5] + ("A" if lot13[1][5] != "A" else "B") + lot13[1][6:]
verifie("5 faute de frappe -> MAL_ECRIT (rien en base)", sms("+22670000010", typo)["resultat"] == "MAL_ECRIT")
def inconnu():
    b = "BF" + "".join(B.secrets.choice(B.ALPHABET) for _ in range(8)); return b + B.caractere_controle(b)
for i in range(3): r = sms(f"+2267000002{i}", inconnu())
cur.execute("select count(*) from alerte where type='CODES_INCONNUS'"); nb_alertes = cur.fetchone()[0]
verifie("6 code inconnu -> INCONNU, et 3 inconnus -> alerte CODES_INCONNUS", r["resultat"] == "INCONNU" and nb_alertes == 1)
verifie("7 code du lot expire -> EXPIRE", sms("+22670000030", lot4)["resultat"] == "EXPIRE")
cur.execute("update lot set statut='RAPPELE' where id_lot=2")
c2 = [c for i, c in enumerate(codes[:90]) if i % 3 == 1][0]
verifie("8 lot rappele -> REVOQUE", sms("+22670000031", c2)["resultat"] == "REVOQUE")
for i in range(6): r = sms("+22670000040", lot13[2 + i])
verifie("9 6 demandes en 1 minute -> LIMITE", r["resultat"] == "LIMITE")
cible = [c for i, c in enumerate(codes[:90]) if i % 3 == 2][5]
with cf.ThreadPoolExecutor(20) as ex: res = list(ex.map(lambda i: sms(f"+226700001{i:02d}", cible)["resultat"], range(20)))
verifie(f"10 20 telephones en meme temps : VRAI = {res.count('VRAI')} sur 20 (attendu 1)", res.count("VRAI") == 1)
verifie("11 mauvaise cle -> 403", cl.post("/sms-entrant?cle=mauvaise", json={"expediteur": "+1", "texte": "x"}).status_code == 403)
cur.execute("select count(*) from verification where tel_hash like '+%' or code_hash like 'BF%'")
verifie("12 aucun numero ni code en clair en base", cur.fetchone()[0] == 0)
exemples = [{"resultat": "VRAI", "produit": "Artemether-Lumefantrine-Test", "dosage": "20/120 mg", "lot": "L24C09", "expiration": "2027-12-31"},
 {"resultat": "DEJA_UTILISE", "date_premiere": "2026-10-12T10:32:00+00:00"}, {"resultat": "INCONNU"}, {"resultat": "MAL_ECRIT"},
 {"resultat": "LIMITE"}, {"resultat": "EXPIRE", "expiration": "2025-12-31"}, {"resultat": "REVOQUE"}]
longueurs = [len(M.fabriquer_message(e)) for e in exemples]
verifie(f"13 messages <= 160 caracteres, ASCII : {longueurs}", max(longueurs) <= 160 and all(M.fabriquer_message(e).isascii() for e in exemples))
acc = M.fabriquer_message({"resultat": "VRAI", "produit": "Paracétamol", "dosage": "500 mg", "lot": "L1", "expiration": "2028-03-31"})
verifie("14 les accents sont retires (Paracetamol)", "Paracetamol" in acc and acc.isascii())
print("TOUS LES TESTS PASSENT")
