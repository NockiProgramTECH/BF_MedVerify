# BF-MedVerify V2 - code de la feuille de route

Fichiers : sql/01_tables.sql, sql/02_donnees_test.sql, sql/03_verifier_code.sql (a coller dans Supabase > SQL Editor, dans cet ordre),
bf_codes.py (outils), generer_codes.py (codes + SQL), main.py (API FastAPI), test_base.py (recette).

## Demarrage
1. Creer le projet Supabase, executer les 3 fichiers SQL.
2. `python -m venv venv` puis `venv\Scripts\activate` (Windows) ; `pip install -r requirements.txt`
3. Copier `.env.example` en `.env`, remplir les 4 valeurs. SAUVEGARDER `BFMV_PEPPER` dans 2 endroits : sans lui, tous les codes deviennent illisibles.
4. `python generer_codes.py demo` -> coller `insert_codes.sql` dans Supabase ; imprimer `liste_codes.txt` puis le detruire.
5. `uvicorn main:app --reload` puis ouvrir http://127.0.0.1:8000/docs (POST /verifier, remplir `cle` avec API_KEY).

## Tests automatiques (14 scenarios)
`test_base.py` VIDE les tables : a lancer UNIQUEMENT sur une base PostgreSQL LOCALE de test.
`pip install psycopg2-binary httpx` puis `python test_base.py`

## Regles
- Ne jamais mettre sur GitHub : `.env`, `liste_codes.txt`, la cle service_role, le pepper.
- Ne jamais stocker un code ou un numero de telephone en clair.
- Aucun vrai medicament sans accord ecrit de la Faso FDA et du titulaire d'AMM.
