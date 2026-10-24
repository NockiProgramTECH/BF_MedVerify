# BF-MedVerify V2 — API, ORM SQLAlchemy & Passerelle httpSMS

Application de verification d'authenticite des medicaments reposant sur **FastAPI**, **SQLAlchemy ORM** (aucun SQL brut), **PostgreSQL** et **httpSMS** pour la reception et l'envoi des reponses SMS aux citoyens.

Une variable d'environnement unique (`APP_ENV`) pilote le fonctionnement du projet :
- `APP_ENV=local` : connexion a un serveur **PostgreSQL local** (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` ou `LOCAL_DATABASE_URL`) et simulation SMS par defaut.
- `APP_ENV=online` : connexion a n'importe quelle base **PostgreSQL distante** via `DATABASE_URL` (Render, Neon, Railway, Koyeb, AWS RDS, VPS PostgreSQL, URI PostgreSQL Supabase, etc.) et envoi SMS actif des que `HTTPSMS_API_KEY` est renseignee.

## Architecture des fichiers
- `config.py` : lecture de `.env`, pilotage `APP_ENV` (`local` / `online`) et configuration httpSMS.
- `models.py` : modeles declaratifs SQLAlchemy ORM (`Produit`, `Lot`, `CodeSecurite`, `Verification`, `Alerte`).
- `database.py` : moteur SQLAlchemy, pool de connexions et session ORM (`get_db`).
- `services.py` : logique metier de verification, anti-spam, verrouillage concurrent (`with_for_update`) et alertes via SQLAlchemy ORM.
- `sms_client.py` : envoi des reponses SMS aux clients via l'API `httpsms.com` (`POST /v1/messages/send`), envoi optionnel des alertes Faso FDA et validation JWT `HS256` des webhooks entrants.
- `init_db.py` : creation automatique des tables et chargement optionnel des donnees de demonstration via l'ORM.
- `generer_codes.py` : generation des codes et insertion directe de leurs empreintes en base via l'ORM.
- `bf_codes.py` : generation, normalisation, caractere de controle et empreintes HMAC-SHA256.
- `main.py` : API FastAPI (`/verifier`, `/sms-entrant`, `/httpsms/webhook`, `/health`, Swagger UI embarque hors-ligne).
- `test_base.py` : suite de tests automatiques de recette (SQLAlchemy ORM + webhook/envoi httpSMS).
- [`DOCUMENTATION_TECHNIQUE.md`](./DOCUMENTATION_TECHNIQUE.md) : documentation technique exhaustive fonction par fonction (signatures, types, retours, justifications metier et techniques).
- [`GOUVERNANCE.md`](./GOUVERNANCE.md) : qui fait quoi — rôles, droits, interdits, qui crée les codes, qui valide, qui suspend, et les huit décisions à arbitrer.

## Maquette de pilotage (`maquette/`)

Le dossier [`maquette/`](./maquette/README.md) contient une maquette **HTML/CSS/JS autonome** (aucune dependance, aucun appel reseau) de l'ecosysteme complet : site public de presentation, back-office Faso FDA (11 pages), portails pharmacie et laboratoire. Elle sert de reference visuelle et fonctionnelle pour le developpement front-end ; les donnees y sont fictives.

Ouvrir directement `maquette/index.html`, ou servir le dossier avec `python3 -m http.server 8000`. Les details (pages, palette, interactions, outils de controle) sont dans [`maquette/README.md`](./maquette/README.md).

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

## Configuration des reponses SMS avec httpSMS
Attention a bien distinguer les **deux cles** dans httpSMS :
1. **Sur votre telephone Android (carte SIM locale)** :
   - Installer l'application Android officielle **httpSMS** (`https://apk.httpsms.com/HttpSms.apk`).
   - Creer une **Phone API Key** sur [`https://httpsms.com/phone-api-keys`](https://httpsms.com/phone-api-keys) et scanner son QR code **uniquement dans l'application Android** (cette cle permet au telephone d'envoyer et recevoir les SMS).
2. **Sur votre serveur FastAPI (`.env` ou variables d'environnement de l'hebergeur)** :
   - Recuperer la **cle API principale du compte** sur [`https://httpsms.com/settings`](https://httpsms.com/settings) et la renseigner dans `HTTPSMS_API_KEY`.
   - Renseigner `HTTPSMS_FROM_NUMBER=+226XXXXXXXX` (numero de la carte SIM du telephone Android) et `HTTPSMS_ENABLED=true`.
3. **Reception automatique et reponse SMS client (Webhook httpSMS)** :
   - Dans [`https://httpsms.com/settings#webhooks`](https://httpsms.com/settings#webhooks), creer un webhook :
     - **Callback URL** : `https://<votre-domaine>/httpsms/webhook`
     - **Signing Key** : generer une cle secrete d'au moins 32 caracteres (`python -c "import secrets;print(secrets.token_urlsafe(32))"`) et la reporter dans `HTTPSMS_WEBHOOK_SIGNING_KEY`.
     - **Event** : cocher `message.phone.received`.
   - Des qu'un citoyen envoie `VERIF BF...` par SMS a votre telephone Android, `POST /httpsms/webhook` verifie le code dans PostgreSQL et renvoie automatiquement le SMS de reponse au citoyen depuis le meme numero Android (`data.owner` $\rightarrow$ `data.contact`).

## Deploiement en ligne (`APP_ENV=online`)
1. Definir les variables d'environnement sur votre hebergeur :
   - `APP_ENV=online`
   - `DATABASE_URL=postgresql://utilisateur:mot_de_passe@hote:5432/nom_base?sslmode=require`
   - `BFMV_PEPPER=...`
   - `API_KEY=...`
   - `HTTPSMS_ENABLED=true`, `HTTPSMS_API_KEY=...`, `HTTPSMS_FROM_NUMBER=...`, `HTTPSMS_WEBHOOK_SIGNING_KEY=...`
2. Demarrer l'API : `uvicorn main:app --host 0.0.0.0 --port $PORT` (les tables sont creees automatiquement par SQLAlchemy ORM si elles n'existent pas encore).

## Tests automatiques
`test_base.py` reinitialise les tables via SQLAlchemy ORM : il est bloque automatiquement si `APP_ENV=online` et ne s'execute qu'en mode `APP_ENV=local` sur une base PostgreSQL locale de test.
```bash
python test_base.py
```

## Regles de securite
- Ne jamais publier sur GitHub : `.env`, `liste_codes.txt`, `DATABASE_URL`, `API_KEY`, `BFMV_PEPPER`, `HTTPSMS_API_KEY`, `HTTPSMS_WEBHOOK_SIGNING_KEY`.
- Ne jamais stocker un code de securite ou un numero de telephone en clair.
- Aucun vrai medicament sans accord ecrit de la Faso FDA et du titulaire d'AMM.
