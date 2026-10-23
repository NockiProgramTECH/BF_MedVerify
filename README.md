# BF-MedVerify V2 — API & ORM SQLAlchemy

Application de verification d'authenticite des medicaments reposant sur **FastAPI**, **SQLAlchemy ORM** (aucun SQL brut) et **PostgreSQL**.

Une variable d'environnement unique (`APP_ENV`) pilote le fonctionnement du projet :
- `APP_ENV=local` : connexion a un serveur **PostgreSQL local** (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` ou `LOCAL_DATABASE_URL`).
- `APP_ENV=online` : connexion a n'importe quelle base **PostgreSQL distante** via `DATABASE_URL` (Render, Neon, Railway, Koyeb, AWS RDS, VPS PostgreSQL, URI PostgreSQL Supabase, etc.).

## Architecture des fichiers
- `config.py` : lecture de `.env` et pilotage `APP_ENV` (`local` / `online`).
- `models.py` : modeles declaratifs SQLAlchemy ORM (`Produit`, `Lot`, `CodeSecurite`, `Verification`, `Alerte`).
- `database.py` : moteur SQLAlchemy, pool de connexions et session ORM (`get_db`).
- `services.py` : logique metier de verification, anti-spam, verrouillage concurrent (`with_for_update`) et alertes via SQLAlchemy ORM.
- `init_db.py` : creation automatique des tables et chargement optionnel des donnees de demonstration via l'ORM.
- `generer_codes.py` : generation des codes et insertion directe de leurs empreintes en base via l'ORM.
- `bf_codes.py` : generation, normalisation, caractere de controle et empreintes HMAC-SHA256.
- `main.py` : API FastAPI (`/verifier`, `/sms-entrant`, `/health`).
- `test_base.py` : suite de tests automatiques de recette (100 % SQLAlchemy ORM).

## Demarrage en local (`APP_ENV=local`)
1. Creer un utilisateur et une base sur votre serveur PostgreSQL local (ex. utilisateur `bfmv`, base `bfmv`).
2. Creer l'environnement virtuel et installer les dependances :
   ```bash
   python -m venv venv
   # Windows : venv\Scripts\activate | Linux/macOS : source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Copier `.env.example` en `.env`, verifier `APP_ENV=local`, renseigner vos parametres PostgreSQL locaux ainsi que `BFMV_PEPPER` et `API_KEY`.
   **Important** : sauvegarder `BFMV_PEPPER` dans 2 endroits surs (sans lui, les codes deviennent illisibles).
4. Initialiser les tables et generer les codes de demonstration :
   ```bash
   python init_db.py demo
   python generer_codes.py demo
   ```
   Imprimer `liste_codes.txt` puis le detruire (seules les empreintes sont stockees dans PostgreSQL).
5. Lancer l'API :
   ```bash
   uvicorn main:app --reload
   ```
   Ouvrir `http://127.0.0.1:8000/docs` (`POST /verifier`, remplir `cle` avec `API_KEY`).

## Deploiement en ligne (`APP_ENV=online`)
1. Definir les variables d'environnement sur votre hebergeur :
   - `APP_ENV=online`
   - `DATABASE_URL=postgresql://utilisateur:mot_de_passe@hote:5432/nom_base?sslmode=require` (les prefixes `postgres://` et `postgresql://` sont tous deux acceptes)
   - `BFMV_PEPPER=...`
   - `API_KEY=...`
2. Au demarrage (`uvicorn main:app --host 0.0.0.0 --port $PORT`), les tables sont creees automatiquement par SQLAlchemy ORM si elles n'existent pas encore (ou via `python init_db.py`).

## Tests automatiques
`test_base.py` reinitialise les tables via SQLAlchemy ORM : il est bloque automatiquement si `APP_ENV=online` et ne s'execute qu'en mode `APP_ENV=local` sur une base PostgreSQL locale de test.
```bash
python test_base.py
```

## Regles de securite
- Ne jamais publier sur GitHub : `.env`, `liste_codes.txt`, `DATABASE_URL`, `API_KEY`, `BFMV_PEPPER`.
- Ne jamais stocker un code de securite ou un numero de telephone en clair.
- Aucun vrai medicament sans accord ecrit de la Faso FDA et du titulaire d'AMM.
