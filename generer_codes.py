"""Genere des codes et le fichier SQL a coller dans Supabase.
   python generer_codes.py demo          -> 100 codes de demonstration (lots 1 a 4)
   python generer_codes.py lot 7 500     -> 500 codes pour le lot numero 7
   python generer_codes.py inconnus 5    -> 5 codes BIEN FORMES mais absents de la base (faux codes de test)
"""
import sys
from dotenv import load_dotenv
load_dotenv()                      # lit BFMV_PEPPER dans .env AVANT d'importer bf_codes
from bf_codes import nouveau_code, empreinte

def choisir(n):
    codes = set()
    while len(codes) < n:          # set = pas de doublons
        codes.add(nouveau_code())
    return sorted(codes)

if len(sys.argv) >= 2 and sys.argv[1] == "demo":
    codes = choisir(100)
    lots = [4 if i >= 90 else (i % 3) + 1 for i in range(100)]   # 10 codes sur le lot 4 (expire)
elif len(sys.argv) == 4 and sys.argv[1] == "lot":
    codes = choisir(int(sys.argv[3]))
    lots = [int(sys.argv[2])] * len(codes)
elif len(sys.argv) == 3 and sys.argv[1] == "inconnus":
    print("\n".join(choisir(int(sys.argv[2]))))      # rien n'est enregistre
    sys.exit()
else:
    sys.exit(__doc__)

lignes = [f"({lot}, '{empreinte('code', c)}')" for lot, c in zip(lots, codes)]
with open("insert_codes.sql", "w") as f:       # ne contient que des empreintes
    f.write("insert into code_securite (id_lot, code_hash) values\n" + ",\n".join(lignes) + ";\n")
with open("liste_codes.txt", "w") as f:        # SEUL endroit ou les codes sont en clair
    f.write("\n".join(codes) + "\n")
print(f"OK : {len(codes)} codes. Colle insert_codes.sql dans Supabase ; imprime liste_codes.txt puis detruis-le.")
