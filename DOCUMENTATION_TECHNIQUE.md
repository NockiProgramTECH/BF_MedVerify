# Documentation Technique Complète — BF-MedVerify V2

Ce document décrit de façon exhaustive l'architecture et le code source du projet **BF-MedVerify**, **fichier par fichier, classe par classe, constante par constante et fonction par fonction** : rôle exact, justification technique/métier (*pourquoi l'élément existe*), paramètres et types d'entrée, type et structure de retour, effets de bord et exceptions éventuelles.

---

## Table des matières

1. [Architecture globale et flux d'exécution](#1-architecture-globale-et-flux-dexécution)
2. [Variables d'environnement de référence](#2-variables-denvironnement-de-référence)
3. [Module `config.py` — Configuration centrale et pilotage `APP_ENV`](#3-module-configpy--configuration-centrale-et-pilotage-app_env)
4. [Module `models.py` — Modèles déclaratifs SQLAlchemy 2.0 ORM](#4-module-modelspy--modèles-déclaratifs-sqlalchemy-20-orm)
5. [Module `database.py` — Moteur SQLAlchemy, Pool et Sessions ORM](#5-module-databasepy--moteur-sqlalchemy-pool-et-sessions-orm)
6. [Module `bf_codes.py` — Cryptographie, Génération et Validation des codes](#6-module-bf_codespy--cryptographie-génération-et-validation-des-codes)
7. [Module `services.py` — Logique métier transactionnelle ORM](#7-module-servicespy--logique-métier-transactionnelle-orm)
8. [Module `init_db.py` — Initialisation du schéma et données de démonstration](#8-module-init_dbpy--initialisation-du-schéma-et-données-de-démonstration)
9. [Module `generer_codes.py` — Génération de lots de codes en ligne de commande](#9-module-generer_codespy--génération-de-lots-de-codes-en-ligne-de-commande)
10. [Module `main.py` — API HTTP FastAPI, Messages SMS GSM-7 et Swagger embarqué](#10-module-mainpy--api-http-fastapi-messages-sms-gsm-7-et-swagger-embarqué)
11. [Module `test_base.py` — Suite de tests automatisés de recette](#11-module-test_basepy--suite-de-tests-automatisés-de-recette)

---

## 1. Architecture globale et flux d'exécution

BF-MedVerify permet à un patient ou un pharmacien de vérifier l'authenticité d'une boîte de médicament (par SMS ou appel API) à partir d'un code unique à 11 caractères imprimé sous couche grattable, **sans jamais stocker ni les codes ni les numéros de téléphone en clair** dans la base de données.

### Flux d'une demande de vérification

```text
Utilisateur / Passerelle SMS
        │
        ▼  POST /sms-entrant?cle=...  ou  POST /verifier?cle=...
┌───────────────────────────────────────────────────────────────────┐
│ main.py (FastAPI)                                                 │
│  1. verifier_cle(cle)        -> Vérifie API_KEY (temps constant)  │
│  2. normaliser(code)         -> Majuscules, retire "VERIF", etc.  │
│  3. bien_forme(code)         -> Contrôle syntaxe + somme mod 31   │
│     └─ Si invalide -> retourne immédiatement "MAL_ECRIT" (0 SQL)  │
│  4. empreinte("code", ...)   -> HMAC-SHA256 avec BFMV_PEPPER      │
│     empreinte("phone", ...)  -> HMAC-SHA256 avec BFMV_PEPPER      │
└───────────────────────────────┬───────────────────────────────────┘
                                │ Session ORM injectée via get_db()
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│ services.py (SQLAlchemy ORM — Zéro SQL brut)                      │
│  1. Anti-spam : max 5 demandes / minute / téléphone -> "LIMITE"   │
│  2. SELECT ... FOR UPDATE sur CodeSecurite (verrou concurrent)    │
│  3. Code absent -> trace "INCONNU" + alerte si >= 3 en 24 h       │
│  4. Évaluation prioritaire :                                      │
│     REVOQUE/RAPPELE > EXPIRE > 1re vérif (VRAI) > même tél (VRAI) │
│     > autre tél (DEJA_UTILISE + alerte si >= 3 téléphones)        │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│ database.py + config.py + models.py                               │
│  • APP_ENV=local  -> Serveur PostgreSQL local (POSTGRES_*)        │
│  • APP_ENV=online -> Base PostgreSQL distante (DATABASE_URL)      │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Variables d'environnement de référence

| Variable | Mode concerné | Type | Défaut | Obligatoire | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `APP_ENV` | Tous | `str` | `"local"` | Non | Pilote le mode global du projet (`local` ou `online`). |
| `POSTGRES_HOST` | `local` | `str` | `"localhost"` | Non | Hôte du serveur PostgreSQL local. |
| `POSTGRES_PORT` | `local` | `int` | `5432` | Non | Port TCP du serveur PostgreSQL local. |
| `POSTGRES_USER` | `local` | `str` | `"bfmv"` | Non | Utilisateur PostgreSQL local. |
| `POSTGRES_PASSWORD` | `local` | `str` | `"bfmv"` | Non | Mot de passe PostgreSQL local. |
| `POSTGRES_DB` | `local` | `str` | `"bfmv"` | Non | Nom de la base PostgreSQL locale. |
| `LOCAL_DATABASE_URL` | `local` | `str` | `""` | Non | URL PostgreSQL complète optionnelle remplaçant `POSTGRES_*` en local. |
| `DATABASE_URL` | `online` | `str` | `""` | **Oui (en ligne)** | URL de connexion PostgreSQL distante (Render, Neon, Railway, VPS, AWS RDS, Supabase URI, etc.). |
| `BFMV_PEPPER` | Tous | `str` | `""` | **Oui** | Secret cryptographique serveur utilisé par HMAC-SHA256 pour hacher les codes et les téléphones. |
| `API_KEY` | Tous | `str` | `""` | **Oui** | Clé secrète exigée dans le paramètre de requête `?cle=...` des endpoints protégés. |
| `SQL_ECHO` | `local` | `bool` | `False` | Non | Affiche les requêtes SQL générées par SQLAlchemy dans la console (forcé à `False` en mode `online`). |
| `AUTO_INIT_DB` | Tous | `bool` | `True` | Non | Crée automatiquement les tables manquantes au démarrage de FastAPI. |
| `DB_POOL_SIZE` | Tous | `int` | `10` | Non | Nombre de connexions permanentes maintenues dans le pool SQLAlchemy. |
| `DB_MAX_OVERFLOW` | Tous | `int` | `20` | Non | Nombre maximal de connexions supplémentaires temporaires en cas de pic de charge. |

---

## 3. Module `config.py` — Configuration centrale et pilotage `APP_ENV`

Ce module centralise la lecture des variables d'environnement (et du fichier `.env` grâce à `load_dotenv()`) afin qu'aucun autre module n'ait à interpréter lui-même le mode d'exécution (`local` vs `online`).

### Constantes globales

#### `ALIASES_LOCAL`
- **Type** : `set[str]`
- **Valeur** : `{"local", "dev", "development"}`
- **Ce qu'elle fait** : Regroupe les valeurs textuelles reconnues comme environnement local.
- **Pourquoi elle existe** : Permet d'accepter les conventions courantes des développeurs (`dev`, `development`) tout en les normalisant systématiquement vers `"local"`.

#### `ALIASES_ONLINE`
- **Type** : `set[str]`
- **Valeur** : `{"online", "prod", "production", "en_ligne"}`
- **Ce qu'elle fait** : Regroupe les valeurs textuelles reconnues comme environnement distant/en ligne.
- **Pourquoi elle existe** : Évite les erreurs de déploiement lorsqu'un hébergeur ou un administrateur utilise `prod`, `production` ou `en_ligne` au lieu de `online`.

---

### Fonctions du module `config.py`

#### `get_app_env() -> str`
- **Paramètres** : Aucun.
- **Type de retour** : `str` (uniquement `"local"` ou `"online"`).
- **Exceptions levées** : `ValueError` si `APP_ENV` contient une valeur non reconnue.
- **Ce qu'elle fait** : Lit la variable d'environnement `APP_ENV` (défaut `"local"`), supprime les espaces superflus, passe en minuscules et retourne la valeur canonique `"local"` ou `"online"`.
- **Pourquoi elle existe** : Constitue l'aiguilleur unique du projet. Lever immédiatement une `ValueError` en cas de faute de frappe (ex. `APP_ENV=onlne`) empêche l'application de basculer silencieusement sur le mauvais environnement.

#### `is_local() -> bool`
- **Paramètres** : Aucun.
- **Type de retour** : `bool` (`True` si le mode actif est `"local"`, `False` sinon).
- **Ce qu'elle fait** : Compare le résultat de `get_app_env()` à `"local"`.
- **Pourquoi elle existe** : Offre un prédicat lisible et expressif aux modules appelants.

#### `is_online() -> bool`
- **Paramètres** : Aucun.
- **Type de retour** : `bool` (`True` si le mode actif est `"online"`, `False` sinon).
- **Ce qu'elle fait** : Compare le résultat de `get_app_env()` à `"online"`.
- **Pourquoi elle existe** : Permet d'appliquer des restrictions de sécurité spécifiques à la production (ex. désactivation forcée de `SQL_ECHO`).

#### `normaliser_database_url(url: str) -> str`
- **Paramètres** :
  - `url` (`str`) : Chaîne de connexion PostgreSQL brute fournie par l'utilisateur ou l'hébergeur.
- **Type de retour** : `str` (URL compatible avec le dialecte SQLAlchemy `postgresql+psycopg2://`).
- **Ce qu'elle fait** : Supprime les espaces autour de l'URL et remplace les schémas `postgres://` ou `postgresql://` par `postgresql+psycopg2://`. Si un pilote explicite est déjà présent, conserve la chaîne telle quelle.
- **Pourquoi elle existe** : De nombreux hébergeurs cloud (Heroku, Render, Railway, Koyeb, Neon) fournissent une `DATABASE_URL` commençant par `postgres://`. Or, SQLAlchemy 2.x rejette le préfixe historique `postgres://` (`NoSuchModuleError`). Cette fonction rend le projet immédiatement compatible avec n'importe quel fournisseur PostgreSQL.

#### `get_database_url(env: str | None = None) -> str`
- **Paramètres** :
  - `env` (`str | None`, optionnel, défaut `None`) : Force l'évaluation pour `"local"` ou `"online"` si précisé ; sinon interroge `get_app_env()`.
- **Type de retour** : `str` (URL SQLAlchemy complète prête pour `create_engine`).
- **Exceptions levées** : `RuntimeError` si le mode est `"online"` mais que `DATABASE_URL` est vide ou absente ; `ValueError` si `POSTGRES_PORT` n'est pas un entier valide.
- **Ce qu'elle fait** :
  - En mode `"online"` : lit exclusivement `DATABASE_URL`, vérifie sa présence et la normalise.
  - En mode `"local"` : utilise `LOCAL_DATABASE_URL` si définie ; sinon assemble une URL sécurisée via `sqlalchemy.engine.URL.create(...)` à partir de `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` et `POSTGRES_DB`.
- **Pourquoi elle existe** :
  1. **Isolation stricte des environnements** : un développeur peut conserver `DATABASE_URL` (production) dans son fichier `.env` tout en travaillant avec `APP_ENV=local` sans aucun risque que ses scripts locaux ou ses tests destructifs ne touchent la base en ligne.
  2. **Encodage sûr des mots de passe** : `URL.create(...).render_as_string(hide_password=False)` encode proprement les caractères spéciaux (`@`, `:`, `/`, `%`) dans les mots de passe PostgreSQL locaux, évitant les erreurs de parsing d'URI.

#### `get_pepper() -> bytes`
- **Paramètres** : Aucun.
- **Type de retour** : `bytes` (chaîne `BFMV_PEPPER` encodée en UTF-8, ou `b""` si absente).
- **Ce qu'elle fait** : Lit dynamiquement `BFMV_PEPPER` dans `os.environ` et la convertit en octets (`bytes`), format attendu par `hmac.new()`.
- **Pourquoi elle existe** : Évite les problèmes d'ordre d'importation Python (permet de modifier ou charger `BFMV_PEPPER` après l'import initial des modules).

#### `get_api_key() -> str`
- **Paramètres** : Aucun.
- **Type de retour** : `str` (valeur de `API_KEY`, ou `""` si absente).
- **Ce qu'elle fait** : Récupère dynamiquement la clé secrète protégeant les webhooks/endpoints HTTP.
- **Pourquoi elle existe** : Centralise l'accès à la clé API et facilite la surcharge propre pendant les tests automatisés.

#### `get_sql_echo() -> bool`
- **Paramètres** : Aucun.
- **Type de retour** : `bool`.
- **Ce qu'elle fait** : Retourne systématiquement `False` si `is_online()` est vrai ; sinon retourne `True` uniquement si `SQL_ECHO` vaut `"1"`, `"true"`, `"yes"` ou `"oui"`.
- **Pourquoi elle existe** : Permet le débogage SQL en développement local tout en empêchant la journalisation verbeuse des requêtes et paramètres en production.

#### `get_auto_init_db() -> bool`
- **Paramètres** : Aucun.
- **Type de retour** : `bool` (défaut `True`).
- **Ce qu'elle fait** : Indique si l'application FastAPI doit exécuter `initialiser_base()` automatiquement lors de son démarrage (`lifespan`).
- **Pourquoi elle existe** : Permet un déploiement « zéro étape manuelle » sur une base PostgreSQL vierge en ligne, tout en laissant la possibilité de le désactiver (`AUTO_INIT_DB=false`) dans une infrastructure gérée par migrations externes.

#### `get_pool_settings() -> dict`
- **Paramètres** : Aucun.
- **Type de retour** : `dict[str, bool | int]` contenant `{"pool_pre_ping": True, "pool_size": int, "max_overflow": int}`.
- **Ce qu'elle fait** : Construit les paramètres du pool de connexions SQLAlchemy à partir de `DB_POOL_SIZE` (défaut `10`) et `DB_MAX_OVERFLOW` (défaut `20`), avec `pool_pre_ping=True`.
- **Pourquoi elle existe** :
  - `pool_pre_ping=True` vérifie qu'une connexion du pool est toujours vivante avant chaque requête, ce qui est indispensable avec les bases PostgreSQL cloud serverless (Neon, Render, Railway, Supabase) qui ferment les connexions inactives.
  - Un pool dimensionné à `10 + 20 = 30` connexions absorbe sans attente les pics de vérifications simultanées (testé à 20 téléphones concurrents).

---

## 4. Module `models.py` — Modèles déclaratifs SQLAlchemy 2.0 ORM

Ce module remplace intégralement l'ancien script SQL de création de tables (`01_tables.sql`) par des classes Python typées utilisant la syntaxe moderne SQLAlchemy 2.0 (`DeclarativeBase`, `Mapped`, `mapped_column`, `relationship`).

### Classe `Base(DeclarativeBase)`
- **Héritage** : `sqlalchemy.orm.DeclarativeBase`
- **Ce qu'elle fait** : Sert de registre central (`Base.metadata`) à toutes les tables, colonnes, clés étrangères, contraintes et index de l'application.
- **Pourquoi elle existe** : Permet à SQLAlchemy de générer automatiquement le schéma PostgreSQL (`Base.metadata.create_all`) sans écrire une seule ligne de DDL SQL manuel.

---

### Modèle `Produit(Base)` — Table `produit`
Représente un médicament enregistré dans la nomenclature pharmaceutique.

| Attribut Python | Type Python | Type SQL PostgreSQL | Contraintes / Défaut | Rôle métier |
| :--- | :--- | :--- | :--- | :--- |
| `id_produit` | `Mapped[int]` | `SERIAL` (`INTEGER`) | `PRIMARY KEY`, auto-incrémenté | Identifiant technique unique du produit. |
| `nom` | `Mapped[str]` | `TEXT` | `NOT NULL` | Nom commercial du médicament affiché dans le SMS de confirmation. |
| `dci` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Dénomination Commune Internationale (ex. *Paracétamol*). |
| `laboratoire` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Nom du fabricant industriel. |
| `titulaire_amm` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Titulaire de l'Autorisation de Mise sur le Marché. |
| `code_amm` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Numéro national d'AMM (utilisé aussi pour l'idempotence des données démo). |
| `dosage` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Dosage du principe actif (ex. `500 mg`, `20/120 mg`), inclus dans le SMS. |
| `forme` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Forme galénique (ex. `Comprimé`, `Gélule`). |
| `lots` *(relation)* | `Mapped[list["Lot"]]` | *(Relation ORM 1-N)* | `back_populates="produit"`, `cascade="all, delete-orphan"` | Liste des lots fabriqués pour ce produit. |

---

### Modèle `Lot(Base)` — Table `lot`
Représente un lot de fabrication précis d'un médicament, avec sa date de péremption et son statut sanitaire.

- **Contraintes de table (`__table_args__`)** :
  - `UniqueConstraint("id_produit", "numero_lot", name="uq_lot_produit_numero")` : interdit d'enregistrer deux fois le même numéro de lot pour un même médicament.
  - `CheckConstraint("statut IN ('ACTIF', 'RAPPELE')", name="ck_lot_statut")` : garantit au niveau PostgreSQL que le statut d'un lot ne peut prendre aucune autre valeur que `'ACTIF'` ou `'RAPPELE'`.

| Attribut Python | Type Python | Type SQL PostgreSQL | Contraintes / Défaut | Rôle métier |
| :--- | :--- | :--- | :--- | :--- |
| `id_lot` | `Mapped[int]` | `SERIAL` (`INTEGER`) | `PRIMARY KEY`, auto-incrémenté | Identifiant technique unique du lot. |
| `id_produit` | `Mapped[int]` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (produit.id_produit)` | Rattachement obligatoire au médicament correspondant. |
| `numero_lot` | `Mapped[str]` | `TEXT` | `NOT NULL` | Numéro imprimé sur la boîte (ex. `L24A17`) pour comparaison visuelle par le patient. |
| `date_fabrication` | `Mapped[Optional[date]]` | `DATE` | `NULL` autorisé | Date de production du lot. |
| `date_expiration` | `Mapped[date]` | `DATE` | `NOT NULL` | Date limite d'utilisation ; déclenche le statut `EXPIRE` si dépassée. |
| `statut` | `Mapped[str]` | `TEXT` | `NOT NULL`, défaut `'ACTIF'` | `'ACTIF'` en circulation normale, `'RAPPELE'` en cas de retrait sanitaire du lot entier. |
| `produit` *(relation)* | `Mapped["Produit"]` | *(Relation ORM N-1)* | `back_populates="lots"` | Accès direct à l'objet `Produit` parent depuis un lot. |
| `codes` *(relation)* | `Mapped[list["CodeSecurite"]]` | *(Relation ORM 1-N)* | `back_populates="lot"`, `cascade="all, delete-orphan"` | Ensemble des codes unitaires rattachés à ce lot. |

---

### Modèle `CodeSecurite(Base)` — Table `code_securite`
Représente l'étiquette unitaire apposée sur **une boîte individuelle** de médicament.

- **Contrainte de table (`__table_args__`)** :
  - `CheckConstraint("statut IN ('NON_UTILISE', 'UTILISE', 'REVOQUE')", name="ck_code_securite_statut")` : verrouille l'intégrité des états possibles d'un code unitaire.

| Attribut Python | Type Python | Type SQL PostgreSQL | Contraintes / Défaut | Rôle métier |
| :--- | :--- | :--- | :--- | :--- |
| `id_code` | `Mapped[int]` | `SERIAL` (`INTEGER`) | `PRIMARY KEY`, auto-incrémenté | Identifiant interne du code. |
| `id_lot` | `Mapped[int]` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (lot.id_lot)` | Lot auquel appartient cette boîte. |
| `code_hash` | `Mapped[str]` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Empreinte hexadécimale HMAC-SHA256 du code (64 caractères). **Jamais le code en clair** : même en cas de fuite de la base, un attaquant ne peut pas fabriquer de fausses boîtes. |
| `statut` | `Mapped[str]` | `TEXT` | `NOT NULL`, défaut `'NON_UTILISE'` | Cycle de vie : `'NON_UTILISE'` $\rightarrow$ `'UTILISE'` dès la 1re vérification (ou `'REVOQUE'` si neutralisé). |
| `date_premiere_verification` | `Mapped[Optional[datetime]]` | `TIMESTAMPTZ` | `NULL` initialement | Horodatage UTC exact de la toute première vérification (communiqué en cas de `DEJA_UTILISE`). |
| `premier_tel_hash` | `Mapped[Optional[str]]` | `VARCHAR(64)` | `NULL` initialement | Empreinte HMAC-SHA256 du 1er téléphone ayant vérifié la boîte. Permet au **même acheteur** de revérifier sa boîte sans fausse alerte tout en détectant tout **autre téléphone**. |
| `lot` *(relation)* | `Mapped["Lot"]` | *(Relation ORM N-1)* | `back_populates="codes"` | Lot associé à cette boîte. |
| `verifications` *(relation)* | `Mapped[list["Verification"]]` | *(Relation ORM 1-N)* | `back_populates="code_securite"` | Historique complet des vérifications portant sur ce code. |
| `alertes` *(relation)* | `Mapped[list["Alerte"]]` | *(Relation ORM 1-N)* | `back_populates="code_securite"` | Alertes générées autour de ce code. |

---

### Modèle `Verification(Base)` — Table `verification`
Journal d'audit immuable traçant chaque tentative de vérification valide syntaxiquement.

- **Index de performance (`__table_args__`)** :
  1. `Index("ix_verification_tel_date", "tel_hash", "date_heure")` : accélère le calcul anti-spam (comptage des demandes d'un téléphone sur la dernière minute).
  2. `Index("ix_verification_id_code", "id_code")` : accélère le comptage du nombre de téléphones distincts ayant scanné/vérifié un même code (`CODE_COPIE_PROBABLE`).
  3. `Index("ix_verification_resultat_date", "resultat", "date_heure")` : accélère la détection des vagues de faux codes (`CODES_INCONNUS` sur les dernières 24 heures).

| Attribut Python | Type Python | Type SQL PostgreSQL | Contraintes / Défaut | Rôle métier |
| :--- | :--- | :--- | :--- | :--- |
| `id_verification` | `Mapped[int]` | `BIGSERIAL` (`BIGINT`) | `PRIMARY KEY`, auto-incrémenté | Clé primaire 64 bits dimensionnée pour des millions de journaux SMS. |
| `id_code` | `Mapped[Optional[int]]` | `INTEGER` | `NULL` autorisé, `FOREIGN KEY (code_securite.id_code)` | Référence au code vérifié (`None` lorsqu'il s'agit d'un code `INCONNU` ou `LIMITE`). |
| `code_hash` | `Mapped[Optional[str]]` | `VARCHAR(64)` | `NULL` autorisé | Empreinte du code soumis. |
| `date_heure` | `Mapped[datetime]` | `TIMESTAMPTZ` | `NOT NULL`, défaut UTC / `now()` | Instant précis de la demande. |
| `canal` | `Mapped[Optional[str]]` | `TEXT` | Défaut `'SMS'` | Canal d'entrée (`'SMS'`, `'WEB'`, `'USSD'`, etc.). |
| `tel_hash` | `Mapped[str]` | `VARCHAR(64)` | `NOT NULL` | Empreinte HMAC-SHA256 de l'expéditeur (respect de la vie privée : aucun numéro en clair). |
| `resultat` | `Mapped[str]` | `TEXT` | `NOT NULL` | Verdict retourné (`VRAI`, `DEJA_UTILISE`, `EXPIRE`, `REVOQUE`, `INCONNU`, `LIMITE`). |
| `code_securite` *(relation)* | `Mapped[Optional["CodeSecurite"]]` | *(Relation ORM N-1)* | `back_populates="verifications"` | Code concerné lorsqu'il existe en base. |

---

### Modèle `Alerte(Base)` — Table `alerte`
Table des signaux de pharmacovigilance destinés aux autorités sanitaires (Faso FDA).

| Attribut Python | Type Python | Type SQL PostgreSQL | Contraintes / Défaut | Rôle métier |
| :--- | :--- | :--- | :--- | :--- |
| `id_alerte` | `Mapped[int]` | `SERIAL` (`INTEGER`) | `PRIMARY KEY`, auto-incrémenté | Identifiant unique de l'alerte. |
| `type` | `Mapped[str]` | `TEXT` | `NOT NULL` | Catégorie d'alerte : `'CODE_COPIE_PROBABLE'` ou `'CODES_INCONNUS'`. |
| `id_code` | `Mapped[Optional[int]]` | `INTEGER` | `NULL` autorisé, `FOREIGN KEY` | Renseigné pour `'CODE_COPIE_PROBABLE'`, vide (`None`) pour `'CODES_INCONNUS'`. |
| `detail` | `Mapped[Optional[str]]` | `TEXT` | `NULL` autorisé | Description synthétique (ex. `"3 telephones differents"`, `"3 codes inconnus en 24 h"`). |
| `date_heure` | `Mapped[datetime]` | `TIMESTAMPTZ` | `NOT NULL`, défaut UTC / `now()` | Date de déclenchement (sert aussi au dédoublonnage sur 24 h). |
| `code_securite` *(relation)* | `Mapped[Optional["CodeSecurite"]]` | *(Relation ORM N-1)* | `back_populates="alertes"` | Code objet de la suspicion de contrefaçon. |

---

## 5. Module `database.py` — Moteur SQLAlchemy, Pool et Sessions ORM

Ce module gère le cycle de vie du moteur PostgreSQL (`Engine`) et la fabrique de sessions transactionnelles (`Session`).

### Variables internes du module

| Variable | Type | Valeur initiale | Pourquoi elle existe |
| :--- | :--- | :--- | :--- |
| `_verrou` | `threading.Lock` | `threading.Lock()` | Protège l'initialisation paresseuse du moteur contre les conditions de course lorsque plusieurs requêtes arrivent simultanément au démarrage. |
| `_engine` | `Engine \| None` | `None` | Cache le singleton `Engine` SQLAlchemy afin de réutiliser le pool de connexions TCP entre toutes les requêtes. |
| `_engine_url` | `str \| None` | `None` | Mémorise l'URL active associée à `_engine` pour détecter automatiquement un changement d'environnement (`APP_ENV`) et recréer proprement le moteur si nécessaire. |
| `_session_factory` | `sessionmaker[Session] \| None` | `None` | Fabrique préconfigurée générant des objets `Session` liés au moteur actif. |

---

### Fonctions du module `database.py`

#### `get_engine() -> Engine`
- **Paramètres** : Aucun.
- **Type de retour** : `sqlalchemy.Engine`.
- **Ce qu'elle fait** :
  1. Calcule l'URL active via `get_database_url()`.
  2. Si `_engine` est déjà initialisé pour cette même URL, le retourne immédiatement sans verrouillage (chemin rapide).
  3. Sinon, acquiert `_verrou` (*double-checked locking*), ferme proprement l'éventuel ancien pool (`_engine.dispose()`), instancie un nouveau `Engine` via `create_engine(...)` avec les options de pool, et initialise `_session_factory` avec `autoflush=False`, `autocommit=False`, `expire_on_commit=False`.
- **Pourquoi elle existe** :
  - **Initialisation paresseuse (*lazy*)** : importer les fichiers Python (par exemple pour générer des codes hors-ligne `generer_codes.py inconnus 5` ou tester le formatage des SMS) n'exige pas qu'un serveur PostgreSQL soit déjà connecté.
  - **`expire_on_commit=False`** : évite à SQLAlchemy de réémettre des `SELECT` inutiles après un `db.commit()` lorsqu'on lit les attributs d'un objet déjà chargé.

#### `SessionLocal() -> Session`
- **Paramètres** : Aucun.
- **Type de retour** : `sqlalchemy.orm.Session`.
- **Ce qu'elle fait** : S'assure que le moteur est initialisé via `get_engine()`, puis ouvre et retourne une nouvelle session ORM indépendante.
- **Pourquoi elle existe** : Permet aux scripts CLI (`init_db.py`, `generer_codes.py`, `test_base.py`) d'utiliser la syntaxe idiomatique `with SessionLocal() as db:` garantissant la fermeture automatique de la session.

#### `get_db() -> Generator[Session, None, None]`
- **Paramètres** : Aucun.
- **Type de retour** : `Generator[Session, None, None]` (générateur synchrone pour l'injection de dépendances FastAPI).
- **Ce qu'elle fait** : Crée une session `SessionLocal()` au début d'une requête HTTP, la fournit à la route via `yield db`, puis exécute systématiquement `db.close()` dans le bloc `finally` (même si une exception survient pendant le traitement).
- **Pourquoi elle existe** : Garantit qu'aucune connexion PostgreSQL ne fuit hors du pool et que chaque requête HTTP dispose de sa propre transaction isolée.

---

## 6. Module `bf_codes.py` — Cryptographie, Génération et Validation des codes

Ce module concentre toute la cryptographie et l'arithmétique des codes d'authentification à 11 caractères. Il ne dépend d'aucune base de données.

### Constantes globales

#### `ALPHABET`
- **Type** : `str` (longueur : `31` caractères).
- **Valeur** : `"ABCDEFGHJKMNPQRSTUVWXYZ23456789"`
- **Ce qu'elle fait** : Définit l'ensemble exact des symboles autorisés dans un code BF-MedVerify.
- **Pourquoi elle existe** : Les caractères visuellement ambigus **`0` / `O`** et **`1` / `I` / `L`** sont volontairement exclus. Sur un téléphone basique (SMS) et sur une étiquette grattée parfois abîmée, cela élimine la principale source d'erreurs de lecture humaine. De plus, **31 est un nombre premier**, propriété mathématique cruciale pour que le caractère de contrôle détecte toutes les inversions de caractères.

#### `PEPPER`
- **Type** : `bytes`.
- **Valeur initiale** : `get_pepper()` au moment de l'import.
- **Ce qu'elle fait** : Conserve une valeur de secours du secret HMAC en mémoire.
- **Pourquoi elle existe** : Assure la rétrocompatibilité si un script externe inspecte ou remplace `bf_codes.PEPPER`, tout en laissant la priorité à la lecture dynamique via `get_pepper()`.

---

### Fonctions du module `bf_codes.py`

#### `caractere_controle(corps: str) -> str`
- **Paramètres** :
  - `corps` (`str`) : Les 10 premiers caractères du code (préfixe `"BF"` + 8 caractères aléatoires), composés uniquement de symboles de `ALPHABET`.
- **Type de retour** : `str` (1 caractère appartenant à `ALPHABET`).
- **Ce qu'elle fait** : Calcule la somme pondérée $\left(\sum_{i=0}^{9} (i + 1) \times \text{index}(c_i)\right) \bmod 31$ et renvoie le caractère correspondant dans `ALPHABET`.
- **Pourquoi elle existe** : Comme 31 est un nombre premier :
  1. **Toute erreur sur un seul caractère** modifie la somme modulo 31 $\rightarrow$ 100 % détectée.
  2. **Toute inversion de deux caractères voisins** ($c_i \leftrightarrow c_{i+1}$) modifie la somme de $(\text{idx}(c_{i+1}) - \text{idx}(c_i)) \not\equiv 0 \pmod{31}$ $\rightarrow$ 100 % détectée.
  Ainsi, un patient qui se trompe en tapant son SMS reçoit `"Code mal écrit, relisez-le"` au lieu d'une fausse alerte `"CODE NON RECONNU"` paniquante !

#### `nouveau_code() -> str`
- **Paramètres** : Aucun.
- **Type de retour** : `str` (code complet de 11 caractères, ex. `"BF22DR5TSNX"`).
- **Ce qu'elle fait** : Tire 8 caractères aléatoires avec le générateur cryptographique du système (`secrets.choice`), préfixe par `"BF"` et concatène `caractere_controle(corps)`.
- **Pourquoi elle existe** : Utilise `secrets` (CSPRNG du noyau OS) et non `random` afin qu'il soit mathématiquement impossible de prédire les prochains codes à partir de quelques boîtes achetées ($31^8 = 852\,891\,037\,441$ combinaisons possibles, soit $\approx 39{,}6$ bits d'entropie, plus le facteur 1/31 du contrôle).

#### `normaliser(texte: str) -> str`
- **Paramètres** :
  - `texte` (`str`) : Texte brut saisi par l'utilisateur (ex. `"verif bf-22dr-5tsnx "` ou `"BF 22DR5TSNX"`).
- **Type de retour** : `str` (chaîne alphanumérique majuscule épurée, ex. `"BF22DR5TSNX"`).
- **Ce qu'elle fait** : Supprime tout caractère non alphanumérique (espaces, tirets, ponctuation), convertit en majuscules, et retire le mot-clé `"VERIF"` s'il figure en tête du SMS.
- **Pourquoi elle existe** : En conditions réelles par SMS, les usagers ajoutent des espaces, écrivent en minuscules ou commencent leur message par le mot-clé de routage de l'opérateur télécom (`VERIF BF...`).

#### `bien_forme(code: str) -> bool`
- **Paramètres** :
  - `code` (`str`) : Code préalablement normalisé par `normaliser()`.
- **Type de retour** : `bool` (`True` si le code est syntaxiquement et mathématiquement valide, `False` sinon).
- **Ce qu'elle fait** : Vérifie successivement 4 conditions :
  1. Longueur exacte de 11 caractères ;
  2. Préfixe `"BF"` ;
  3. Tous les caractères appartiennent à `ALPHABET` (aucun `0`, `O`, `1`, `I`, `L`) ;
  4. Le 11e caractère est égal à `caractere_controle(code[:-1])`.
- **Pourquoi elle existe** : Agit comme un pare-feu applicatif gratuit **avant la base de données** : les fautes de frappe ne consomment aucune requête PostgreSQL et ne polluent pas les statistiques d'alertes de contrefaçon.

#### `empreinte(sorte: str, valeur: str) -> str`
- **Paramètres** :
  - `sorte` (`str`) : Domaine d'utilisation de l'empreinte (`"code"` ou `"phone"`).
  - `valeur` (`str`) : Valeur normalisée en clair à hacher.
- **Type de retour** : `str` (chaîne hexadécimale minuscule de 64 caractères).
- **Exceptions levées** : `RuntimeError` si `BFMV_PEPPER` n'est pas configuré.
- **Ce qu'elle fait** : Calcule `HMAC-SHA256(key=secret, msg=f"{sorte}:{valeur}")`.
- **Pourquoi elle existe** :
  1. **Protection contre le vol de base** : un simple `SHA256(code)` sans clé secrète pourrait être cassé par force brute hors-ligne sur $31^8$ possibilités avec des GPU modernes. Avec **HMAC-SHA256 + `BFMV_PEPPER`** conservé hors de la base, une fuite complète des tables PostgreSQL est inutilisable sans le poivre serveur.
  2. **Séparation de domaine (`sorte:valeur`)** : préfixer par `"code:"` ou `"phone:"` garantit qu'une empreinte de téléphone ne pourra jamais entrer en collision avec une empreinte de code.

---

## 7. Module `services.py` — Logique métier transactionnelle ORM

Ce module remplace intégralement l'ancienne procédure stockée PL/pgSQL (`03_verifier_code.sql`) par du code Python pur reposant à 100 % sur l'ORM SQLAlchemy.

### Fonction `verifier_code(db: Session, p_code_hash: str, p_tel_hash: str, p_canal: str = "SMS") -> dict`

- **Paramètres** :
  - `db` (`sqlalchemy.orm.Session`) : Session ORM active rattachée à PostgreSQL.
  - `p_code_hash` (`str`) : Empreinte HMAC-SHA256 (64 caractères) du code vérifié.
  - `p_tel_hash` (`str`) : Empreinte HMAC-SHA256 (64 caractères) du numéro de téléphone demandeur.
  - `p_canal` (`str`, optionnel, défaut `"SMS"`) : Canal de communication à journaliser.
- **Type de retour** : `dict[str, Any]` dont la forme dépend du verdict :
  - Si anti-spam déclenché :
    `{"resultat": "LIMITE"}`
  - Si code absent de la base :
    `{"resultat": "INCONNU", "alerte": str | None}`
  - Si code trouvé en base :
    ```python
    {
        "resultat": "VRAI" | "DEJA_UTILISE" | "EXPIRE" | "REVOQUE",
        "produit": str,               # Nom du médicament
        "dosage": str | None,         # Dosage
        "lot": str,                   # Numéro du lot
        "expiration": str,            # Date ISO 'YYYY-MM-DD'
        "date_premiere": str | None,  # Horodatage ISO 8601 de la 1re vérif
        "alerte": str | None,         # Message d'alerte éventuel pour la Faso FDA
    }
    ```
- **Ce qu'elle fait (détail des 4 phases internes)** :
  1. **Phase 1 — Anti-spam par téléphone** :
     Compte via `func.count(Verification.id_verification)` les vérifications du même `p_tel_hash` survenues depuis moins d'une minute (`maintenant - timedelta(minutes=1)`). Si ce nombre est $\ge 5$, insère une trace `Verification(resultat="LIMITE")`, valide (`db.commit()`) et retourne immédiatement `{"resultat": "LIMITE"}`.
  2. **Phase 2 — Recherche verrouillée du code (`FOR UPDATE`)** :
     Exécute un `select(CodeSecurite)` enrichi de `.options(selectinload(CodeSecurite.lot).selectinload(Lot.produit))`, `.with_for_update()` et `.execution_options(populate_existing=True)`.
     - **Cas `cs is None` (code inconnu)** : insère une `Verification(resultat="INCONNU")`, appelle `db.flush()` (pour que cette insertion soit comptabilisée immédiatement dans la même transaction), compte le nombre total de résultats `"INCONNU"` sur les dernières 24 heures, et si ce total est $\ge 3$ sans qu'aucune `Alerte(type="CODES_INCONNUS")` n'ait déjà été créée dans les 24 heures, crée l'alerte. Valide la transaction et retourne `{"resultat": "INCONNU", "alerte": alerte_msg}`.
  3. **Phase 3 — Arbre de décision sanitaire par priorité stricte** :
     Lorsque le code existe, l'ordre des `if / elif` est vital pour la sécurité du patient :
     - **Priorité 1 (`REVOQUE`)** : si `cs.statut == "REVOQUE"` ou `lot.statut == "RAPPELE"`, le verdict est `"REVOQUE"` (même si le code n'avait jamais été utilisé !).
     - **Priorité 2 (`EXPIRE`)** : sinon si `lot.date_expiration < aujourd_hui`, le verdict est `"EXPIRE"`.
     - **Priorité 3 (`VRAI` — 1re utilisation)** : sinon si `cs.statut == "NON_UTILISE"`, marque `cs.statut = "UTILISE"`, enregistre `cs.date_premiere_verification = maintenant` et `cs.premier_tel_hash = p_tel_hash`, et fixe le verdict à `"VRAI"`.
     - **Priorité 4 (`VRAI` — même propriétaire)** : sinon si `cs.premier_tel_hash == p_tel_hash`, renvoie `"VRAI"` sans modifier la date initiale ni déclencher d'alerte.
     - **Priorité 5 (`DEJA_UTILISE` — téléphone différent)** : dans tous les autres cas, un autre numéro a déjà activé ce code $\rightarrow$ verdict `"DEJA_UTILISE"`.
  4. **Phase 4 — Journalisation et détection de copie industrielle** :
     Insère la ligne `Verification`, exécute `db.flush()`, et si le verdict est `"DEJA_UTILISE"`, compte le nombre de téléphones distincts (`func.count(func.distinct(Verification.tel_hash))`) ayant obtenu `"VRAI"` ou `"DEJA_UTILISE"` sur cet `id_code`. Dès que ce compteur atteint `3` et qu'aucune alerte `CODE_COPIE_PROBABLE` n'existe encore pour cet `id_code`, insère une `Alerte` unique. Valide avec `db.commit()` et retourne le dictionnaire complet.
- **Pourquoi elle existe (choix techniques clés)** :
  - **Pourquoi `.with_for_update()` ?** Si un contrefacteur imprime le même vrai code volé sur 20 boîtes et que 20 personnes envoient le SMS à la même milliseconde, PostgreSQL verrouille la ligne `code_securite` : le 1er thread passe le code à `UTILISE` et commit, puis les 19 autres threads lisent l'état mis à jour (`populate_existing=True`) et reçoivent tous `DEJA_UTILISE`. Sans `FOR UPDATE`, les 20 auraient pu lire `NON_UTILISE` en parallèle et recevoir `VRAI`.
  - **Pourquoi `selectinload` plutôt qu'un `LEFT OUTER JOIN` ?** PostgreSQL interdit `SELECT ... LEFT OUTER JOIN ... FOR UPDATE`. Avec `selectinload`, SQLAlchemy verrouille proprement la seule table `code_securite`, puis charge `Lot` et `Produit` via l'ORM sans conflit SQL.

---

## 8. Module `init_db.py` — Initialisation du schéma et données de démonstration

Ce module remplace l'ancien fichier `02_donnees_test.sql` et permet d'initialiser la base locale ou en ligne via l'ORM.

### Constantes globales

#### `PRODUITS_DEMO`
- **Type** : `list[dict[str, str]]` (3 dictionnaires).
- **Ce qu'elle fait** : Définit 3 médicaments fictifs de test (`Paracetamol-Test`, `Amoxicilline-Test`, `Artemether-Lumefantrine-Test`) avec de faux laboratoires (`LABO-TEST-A/B/C`) et de faux codes AMM (`TEST-0001` à `TEST-0003`).
- **Pourquoi elle existe** : Permet de tester toute la chaîne applicative sans jamais utiliser de vraies références pharmaceutiques officielles sans autorisation réglementaire.

#### `LOTS_DEMO`
- **Type** : `list[dict[str, Any]]` (4 dictionnaires).
- **Ce qu'elle fait** : Définit 3 lots actifs valides (`L24A17`, `L24B02`, `L24C09`) et 1 lot volontairement périmé (`L23Z99`, expiré le `2025-12-31`).
- **Pourquoi elle existe** : Fournit immédiatement un jeu complet couvrant à la fois les cas nominaux (`VRAI`, `DEJA_UTILISE`, `REVOQUE`) et le cas d'un médicament périmé (`EXPIRE`).

---

### Fonctions du module `init_db.py`

#### `initialiser_base() -> None`
- **Paramètres** : Aucun.
- **Type de retour** : `None`.
- **Ce qu'elle fait** : Appelle `Base.metadata.create_all(bind=get_engine())` pour créer dans PostgreSQL toutes les tables, contraintes et index déclarés dans `models.py` s'ils n'existent pas déjà.
- **Pourquoi elle existe** : Opération non destructive et idempotente pouvant être appelée sans risque à chaque démarrage de l'API ou avant un script CLI.

#### `charger_donnees_test(db: Session) -> list[Lot]`
- **Paramètres** :
  - `db` (`sqlalchemy.orm.Session`) : Session ORM ouverte.
- **Type de retour** : `list[Lot]` (liste ordonnée des 4 instances ORM `Lot` de démonstration : les 3 lots actifs suivis du lot expiré).
- **Ce qu'elle fait** :
  1. Pour chaque entrée de `PRODUITS_DEMO`, cherche via `select(Produit).where(Produit.code_amm == ...)` si le produit existe déjà ; sinon l'instancie, l'ajoute et exécute `db.flush()` pour obtenir son `id_produit`.
  2. Pour chaque entrée de `LOTS_DEMO`, cherche via `select(Lot).where(Lot.id_produit == ..., Lot.numero_lot == ...)` si le lot existe déjà ; sinon le crée et exécute `db.flush()`.
  3. Valide la transaction (`db.commit()`) et retourne les 4 objets `Lot`.
- **Pourquoi elle existe** : Son caractère **idempotent** permet de relancer `python init_db.py demo` ou `python generer_codes.py demo` plusieurs fois sans jamais provoquer d'erreur de contrainte d'unicité (`UniqueViolation`), tout en retournant les vrais `id_lot` attribués par PostgreSQL.

#### Point d'entrée CLI (`if __name__ == "__main__":`)
- `python init_db.py` : crée uniquement les tables vides sur l'environnement pointé par `APP_ENV`.
- `python init_db.py demo` : crée les tables puis charge les 3 produits et 4 lots de démonstration.

---

## 9. Module `generer_codes.py` — Génération de lots de codes en ligne de commande

Ce script industriel/démo génère des codes uniques, stocke **uniquement leurs empreintes** en base via SQLAlchemy ORM, et exporte les codes en clair dans un fichier temporaire destiné à l'imprimeur (`liste_codes.txt`).

### Fonctions du module `generer_codes.py`

#### `choisir(n: int) -> list[str]`
- **Paramètres** :
  - `n` (`int`) : Nombre exact de codes uniques à fabriquer.
- **Type de retour** : `list[str]` (liste triée alphabétiquement de `n` codes distincts de 11 caractères).
- **Ce qu'elle fait** : Remplit un `set[str]` en appelant `nouveau_code()` jusqu'à obtenir exactement `n` éléments distincts, puis retourne `sorted(codes)`.
- **Pourquoi elle existe** :
  1. Le `set` garantit mathématiquement l'absence totale de doublons au sein d'un lot généré.
  2. Le tri `sorted()` brise l'ordre chronologique de génération du CSPRNG avant l'écriture dans `liste_codes.txt`.

#### `main() -> None`
- **Paramètres** : Aucun (lit `sys.argv`).
- **Type de retour** : `None`.
- **Exceptions / Arrêts** : Appelle `sys.exit(...)` avec le message d'aide si les arguments sont invalides ou si le `id_lot` demandé n'existe pas dans PostgreSQL.
- **Ce qu'elle fait** : Gère 3 sous-commandes CLI :
  1. `python generer_codes.py inconnus <N>` : affiche sur la sortie standard `N` codes bien formés (avec caractère de contrôle valide) sans toucher à la base de données. Utile pour tester la détection des faux codes (`INCONNU`).
  2. `python generer_codes.py demo` : initialise la base et les lots démo via l'ORM, génère 100 codes (90 répartis sur les 3 lots actifs, 10 sur le 4e lot expiré), insère les 100 objets `CodeSecurite` en base via `db.add_all(...)` + `db.commit()`, et écrit les 100 codes en clair dans `liste_codes.txt`.
  3. `python generer_codes.py lot <ID_LOT> <NB>` : vérifie via `db.get(Lot, id_lot)` que le lot existe réellement dans la base active (`local` ou `online`), génère `NB` codes, enregistre leurs empreintes via SQLAlchemy ORM, et écrit les codes en clair dans `liste_codes.txt`.
- **Pourquoi elle existe** : Supprime complètement l'ancienne étape manuelle consistant à générer un fichier `insert_codes.sql` et à le copier-coller dans un éditeur SQL : l'insertion se fait désormais directement via l'ORM dans PostgreSQL (local ou distant selon `APP_ENV`).

---

## 10. Module `main.py` — API HTTP FastAPI, Messages SMS GSM-7 et Swagger embarqué

Ce module expose l'API web, formate les réponses SMS selon les contraintes télécoms et sert localement l'interface Swagger UI / ReDoc.

### Initialisation et constantes du module

- **`mimetypes.add_type("application/javascript", ".js")` et `mimetypes.add_type("text/css", ".css")`** :
  - **Pourquoi ils existent** : Sur Windows, le registre système associe fréquemment `.js` à `text/plain`. Sans ce forçage explicite avant l'instanciation de `StaticFiles`, les navigateurs modernes bloquent le script Swagger UI (`X-Content-Type-Options` / MIME strict) et affichent une page blanche.
- **`API_KEY: str`** : Valeur initiale lue via `get_api_key()`, servant de repli si une clé est injectée directement sur l'attribut du module.
- **`app: FastAPI`** : Application FastAPI instanciée avec `docs_url=None` et `redoc_url=None` afin de remplacer les pages dépendantes du CDN `cdn.jsdelivr.net` par des routes locales autonomes.
- **`_STATIC_DOCS_DIR: Path`** : Chemin vers le dossier `static/` du paquet `fastapi_offline` contenant `swagger-ui-bundle.js`, `swagger-ui.css`, `redoc.standalone.js` et `favicon.png`, monté sur `/static-offline-docs`.

---

### Modèles de données HTTP (Pydantic `BaseModel`)

#### Classe `Demande(BaseModel)`
 Corps JSON attendu par l'endpoint de test/intégration `POST /verifier`.
- `code` (`str`, obligatoire) : Code saisi (ex. `"BF22DR5TSNX"` ou `"VERIF BF22DR5TSNX"`).
- `telephone` (`str`, défaut `"+22600000000"`) : Numéro de téléphone de l'appelant.
- `canal` (`str`, défaut `"SMS"`) : Canal d'origine (`"SMS"`, `"WEB"`, `"USSD"`).

#### Classe `SmsEntrant(BaseModel)`
Corps JSON attendu par le webhook de la passerelle SMS `POST /sms-entrant`.
- `expediteur` (`str`, obligatoire) : Numéro de téléphone de l'usager ayant envoyé le SMS.
- `texte` (`str`, obligatoire) : Contenu brut du SMS reçu par la passerelle.

---

### Fonctions et routes du module `main.py`

#### `lifespan(_app: FastAPI) -> AsyncIterator[None]`
- **Décorateur** : `@asynccontextmanager`
- **Paramètres** : `_app` (`FastAPI`) : Instance de l'application FastAPI.
- **Type de retour** : Gestionnaire de contexte asynchrone.
- **Ce qu'elle fait** : Au démarrage du serveur Uvicorn, si `get_auto_init_db()` vaut `True`, exécute `initialiser_base()` pour créer les tables manquantes avant d'accepter le trafic HTTP.
- **Pourquoi elle existe** : Remplace l'ancien événement déprécié `@app.on_event("startup")` par le standard moderne ASGI Lifespan de FastAPI.

#### `accueil() -> RedirectResponse` — Route `GET /`
- **Paramètres** : Aucun.
- **Type de retour** : `RedirectResponse` (HTTP `307 Temporary Redirect` vers `"docs"`).
- **Ce qu'elle fait** : Redirige automatiquement la racine du serveur vers l'interface Swagger UI.
- **Pourquoi elle existe** : Évite un `404 Not Found` lorsqu'un utilisateur ouvre `http://127.0.0.1:8000/` ou un aperçu web racine, et utilise une URL relative (`"docs"`) pour fonctionner même derrière un reverse-proxy en sous-chemin.

#### `swagger_ui_html() -> HTMLResponse` — Route `GET /docs`
- **Paramètres** : Aucun.
- **Type de retour** : `HTMLResponse`.
- **Ce qu'elle fait** : Génère la page HTML Swagger UI pointant vers `./openapi.json` et les fichiers locaux `./static-offline-docs/swagger-ui-bundle.js`, `swagger-ui.css` et `favicon.png`.
- **Pourquoi elle existe** : Garantit que la documentation interactive fonctionne **sans Internet en local**, sans blocage FAI/DNS sur `cdn.jsdelivr.net`, et dans n'importe quelle iframe sécurisée.

#### `swagger_ui_redirect() -> HTMLResponse` — Route `GET /docs/oauth2-redirect`
- **Paramètres** : Aucun.
- **Type de retour** : `HTMLResponse`.
- **Ce qu'elle fait** : Fournit la page de retour OAuth2 standard de Swagger UI.
- **Pourquoi elle existe** : Complète l'auto-hébergement de Swagger UI conformément aux spécifications internes de FastAPI.

#### `redoc_html() -> HTMLResponse` — Route `GET /redoc`
- **Paramètres** : Aucun.
- **Type de retour** : `HTMLResponse`.
- **Ce qu'elle fait** : Génère la documentation alternative ReDoc à partir du script embarqué `./static-offline-docs/redoc.standalone.js` avec `with_google_fonts=False`.
- **Pourquoi elle existe** : Fournit une documentation de lecture pure totalement autonome (aucune police Google Fonts ni script externe).

#### `sans_accents(t: str) -> str`
- **Paramètres** :
  - `t` (`str`) : Chaîne de caractères pouvant contenir des caractères accentués (ex. issue d'un nom de produit `"Paracétamol"`).
- **Type de retour** : `str` (chaîne purement ASCII 7 bits).
- **Ce qu'elle fait** : Décompose les caractères accentués en lettre de base + diacritique (`unicodedata.normalize("NFKD", t)`), puis élimine les diacritiques via `.encode("ascii", "ignore").decode()`.
- **Pourquoi elle existe** : **Règle télécom critique** : un SMS standard encodé en alphabet GSM-7 contient jusqu'à **160 caractères** pour le prix d'un seul segment SMS. Dès qu'un seul caractère accentué non-GSM (ex. `ê`, `ô`, `ç` selon opérateur) force le passage en Unicode **UCS-2**, la taille maximale d'un SMS chute brutalement à **70 caractères**, doublant ou triplant le coût télécom et risquant de tronquer les messages d'alerte sanitaire !

#### `mmaa(iso: str) -> str`
- **Paramètres** :
  - `iso` (`str`) : Date au format ISO 8601 `'YYYY-MM-DD'` (ex. `'2028-03-31'`).
- **Type de retour** : `str` au format `'MM/AA'` (ex. `'03/28'`).
- **Ce qu'elle fait** : Extrait le mois (`iso[5:7]`) et les deux derniers chiffres de l'année (`iso[2:4]`).
- **Pourquoi elle existe** : Économise 5 caractères précieux dans le budget de 160 caractères du SMS tout en correspondant au format `MM/AA` habituellement imprimé sur les boîtes de médicaments.

#### `fabriquer_message(r: dict) -> str`
- **Paramètres** :
  - `r` (`dict[str, Any]`) : Dictionnaire résultat issu de `services.verifier_code()` (ou `{"resultat": "MAL_ECRIT"}`).
- **Type de retour** : `str` (message SMS final, garanti 100 % ASCII et $\le 160$ caractères).
- **Ce qu'elle fait** : Construit le message destiné à l'usager selon les 7 verdicts possibles (`VRAI`, `DEJA_UTILISE`, `EXPIRE`, `REVOQUE`, `LIMITE`, `MAL_ECRIT`, `INCONNU`) et applique `sans_accents(m)`.
- **Pourquoi elle existe** : Sépare la logique de décision sanitaire (`services.py`) de la rédaction humaine des consignes de santé publique (comparer avec la boîte, rapporter à la pharmacie, consulter si la maladie continue).

#### `traiter(code: str, telephone: str, canal: str, db: Session | None = None) -> dict`
- **Paramètres** :
  - `code` (`str`) : Texte brut contenant le code à vérifier.
  - `telephone` (`str`) : Numéro de téléphone brut de l'appelant.
  - `canal` (`str`) : Canal de vérification (`"SMS"`, etc.).
  - `db` (`Session | None`, optionnel, défaut `None`) : Session ORM fournie par FastAPI ; si `None`, ouvre automatiquement une session locale temporaire via `SessionLocal()`.
- **Type de retour** : `dict[str, str]` de la forme `{"resultat": str, "message": str}`.
- **Ce qu'elle fait** :
  1. Normalise le code et vérifie `bien_forme(c)` ; en cas d'échec, retourne immédiatement `MAL_ECRIT` sans interroger PostgreSQL.
  2. Nettoie le numéro de téléphone (ne conserve que les chiffres et `+`).
  3. Calcule les deux empreintes HMAC-SHA256 (`empreinte("code", c)` et `empreinte("phone", tel)`).
  4. Appelle `verifier_code(...)` via l'ORM.
  5. Si une alerte réglementaire a été générée (`r.get("alerte")`), la journalise sur la sortie serveur pour transmission à la Faso FDA.
  6. Retourne le code de résultat et le texte SMS formaté.
- **Pourquoi elle existe** : Orchestre de bout en bout le pipeline de vérification et garantit que ni `code` ni `telephone` en clair ne franchissent jamais la frontière vers `services.py` et PostgreSQL.

#### `verifier_cle(cle: str) -> None`
- **Paramètres** :
  - `cle` (`str`) : Clé fournie dans l'URL (`?cle=...`).
- **Type de retour** : `None`.
- **Exceptions levées** : `fastapi.HTTPException(status_code=403, detail="cle invalide")` si `API_KEY` n'est pas configurée côté serveur ou si `cle` ne correspond pas.
- **Ce qu'elle fait** : Compare `cle` et la clé attendue à l'aide de `hmac.compare_digest(cle, cle_attendue)`.
- **Pourquoi elle existe** : Authentifie la passerelle SMS. L'usage de `hmac.compare_digest` (comparaison en temps constant) empêche un attaquant de deviner la clé caractère par caractère en mesurant le temps de réponse du serveur (*timing attack*).

#### `health(db: Session = Depends(get_db)) -> dict` — Route `GET /health`
- **Paramètres** : `db` (`Session`, injectée automatiquement par FastAPI).
- **Type de retour** : `dict[str, str]` : `{"statut": "ok", "environnement": "local" | "online"}`.
- **Ce qu'elle fait** : Exécute une requête ORM légère (`select(Produit.id_produit).limit(1)`) pour attester que PostgreSQL répond bien, et retourne l'état et l'environnement actif.
- **Pourquoi elle existe** : Utilisé par les sondes de supervision (*healthchecks*) des hébergeurs cloud (Render, Railway, Koyeb, Docker, Kubernetes) pour vérifier que l'API **et** sa liaison PostgreSQL sont opérationnelles.

#### `verifier(d: Demande, cle: str = Query(...), db: Session = Depends(get_db)) -> dict` — Route `POST /verifier`
- **Paramètres** :
  - `d` (`Demande`) : Corps JSON validé par Pydantic.
  - `cle` (`str`) : Paramètre d'URL obligatoire `?cle=...`.
  - `db` (`Session`) : Session ORM injectée.
- **Type de retour** : `dict[str, str]` (`{"resultat": ..., "message": ...}`).
- **Ce qu'elle fait** : Contrôle la clé API puis délègue à `traiter(d.code, d.telephone, d.canal, db)`.
- **Pourquoi elle existe** : Point d'entrée structuré destiné aux tests interactifs dans Swagger UI (`/docs`) ainsi qu'aux éventuelles applications web/mobiles partenaires.

#### `sms_entrant(sms: SmsEntrant, cle: str = Query(...), db: Session = Depends(get_db)) -> dict` — Route `POST /sms-entrant`
- **Paramètres** :
  - `sms` (`SmsEntrant`) : Corps JSON envoyé par l'agrégateur/passerelle SMS (`expediteur`, `texte`).
  - `cle` (`str`) : Paramètre d'URL obligatoire `?cle=...`.
  - `db` (`Session`) : Session ORM injectée.
- **Type de retour** : `dict[str, str]` (`{"resultat": ..., "message": ...}`).
- **Ce qu'elle fait** : Contrôle la clé API puis délègue à `traiter(sms.texte, sms.expediteur, "SMS", db)`.
- **Pourquoi elle existe** : Point d'entrée webhook appelé automatiquement à chaque SMS reçu par la passerelle télécom.

---

## 11. Module `test_base.py` — Suite de tests automatisés de recette

Ce script valide de bout en bout l'application réelle (FastAPI + SQLAlchemy ORM + serveur PostgreSQL local) sans aucun mock de base de données et sans SQL brut.

### Garde-fou de sécurité en en-tête
Dès les premières lignes, avant même l'import de `database` ou `models` :
```python
if os.environ.get("APP_ENV", "local").strip().lower() in ("online", "prod", "production", "en_ligne"):
    sys.exit("SECURITE : test_base.py vide les tables et ne doit etre lance qu'avec APP_ENV=local.")
```
- **Pourquoi il existe** : Comme la recette exécute `Base.metadata.drop_all(bind=engine)` pour repartir d'une base propre, ce verrou empêche formellement d'écraser par erreur une base de production distante.

---

### Fonctions utilitaires de test dans `test_base.py`

#### `ok(nom: str, cond: bool) -> None`
- **Paramètres** : `nom` (`str` : intitulé du test), `cond` (`bool` : résultat de l'assertion).
- **Type de retour** : `None`.
- **Ce qu'elle fait** : Affiche `"OK   "` ou `"ECHEC"` suivi du libellé du scénario.
- **Pourquoi elle existe** : Produit un rapport de recette lisible ligne par ligne dans le terminal ou en intégration continue.

#### `verifie(nom: str, cond: bool) -> None`
- **Paramètres** : `nom` (`str`), `cond` (`bool`).
- **Type de retour** : `None`.
- **Ce qu'elle fait** : Appelle `ok(nom, cond)` et interrompt immédiatement le script avec un code de retour non nul (`sys.exit(1)`) dès qu'un test échoue.
- **Pourquoi elle existe** : Garantit un échec rapide (*fail-fast*) exploitable par n'importe quel pipeline CI/CD.

#### `sms(tel: str, texte: str) -> dict` *(fonction locale au bloc `TestClient`)*
- **Paramètres** : `tel` (`str` : numéro expéditeur), `texte` (`str` : contenu du SMS).
- **Type de retour** : `dict[str, str]` (JSON désérialisé de la réponse HTTP).
- **Ce qu'elle fait** : Envoie une vraie requête `POST /sms-entrant?cle=cle-test` au `TestClient` FastAPI, vérifie que le code HTTP est `200`, et retourne le JSON.
- **Pourquoi elle existe** : Factorise les appels HTTP dans les scénarios métier.

#### `inconnu() -> str` *(fonction locale au bloc `TestClient`)*
- **Paramètres** : Aucun.
- **Type de retour** : `str` (code de 11 caractères syntaxiquement valide mais jamais inséré dans PostgreSQL).
- **Ce qu'elle fait** : Génère un code respectant l'alphabet et le caractère de contrôle sans l'ajouter à `code_securite`.
- **Pourquoi elle existe** : Simule des codes contrefaits bien formés afin de tester le verdict `INCONNU` et l'alerte `CODES_INCONNUS`.

---

### Récapitulatif des 19 scénarios vérifiés par `test_base.py`

| N° | Scénario testé | Objectif technique / métier validé |
| :--- | :--- | :--- |
| **0a** | `APP_ENV=local` avec `DATABASE_URL` présente | Vérifie que le mode local utilise bien `POSTGRES_*` et ignore toute `DATABASE_URL` distante. |
| **0b** | `APP_ENV=online` avec `postgres://...` | Vérifie la sélection de `DATABASE_URL` et la normalisation automatique en `postgresql+psycopg2://`. |
| **0c** | `APP_ENV=online` sans `DATABASE_URL` | Vérifie la levée d'une `RuntimeError` explicite au lieu d'un repli silencieux. |
| **1** | 1er téléphone + préfixe `"VERIF "` | Normalisation du préfixe SMS et transition `NON_UTILISE` $\rightarrow$ `UTILISE` (`VRAI`). |
| **2** | Même téléphone en minuscules | Reconnaissance du propriétaire légitime (`premier_tel_hash`) $\rightarrow$ `VRAI` sans fausse alarme. |
| **3** | 2e téléphone différent sur le même code | Détection d'une réutilisation par un tiers $\rightarrow$ `DEJA_UTILISE`. |
| **4** | 3e téléphone différent sur le même code | Déclenchement d'une unique alerte ORM `CODE_COPIE_PROBABLE`. |
| **5** | Faute de frappe d'un caractère | Interception par `caractere_controle` $\rightarrow$ `MAL_ECRIT` sans écriture en base. |
| **6** | 3 codes bien formés absents de la base | Verdict `INCONNU` et création d'une alerte ORM `CODES_INCONNUS` au 3e essai sur 24 h. |
| **7** | Code rattaché au lot 4 (`2025-12-31`) | Détection de la date de péremption dépassée $\rightarrow$ `EXPIRE`. |
| **8** | Lot passé à `statut='RAPPELE'` via l'ORM | Priorité sanitaire du rappel de lot $\rightarrow$ `REVOQUE`. |
| **9** | 6 demandes en moins d'une minute | Déclenchement du limiteur anti-spam à la 6e requête $\rightarrow$ `LIMITE`. |
| **10** | 20 téléphones concurrents (`ThreadPoolExecutor`) | Validation du verrouillage PostgreSQL `FOR UPDATE` : exactement **1 seul** obtient `VRAI` sur 20. |
| **11** | Mauvaise clé API `?cle=mauvaise` | Rejet HTTP `403 Forbidden` par `verifier_cle()`. |
| **12** | Audit des colonnes `tel_hash` et `code_hash` | Preuve qu'aucun numéro (`+%`) ni aucun code (`BF%`) n'est stocké en clair en base. |
| **13** | Longueur et encodage des 7 gabarits SMS | Tous les messages font $\le 160$ caractères et sont 100 % ASCII (1 seul SMS GSM-7). |
| **14** | Produit accentué `"Paracétamol"` | Suppression effective des accents (`"Paracetamol"`) par `sans_accents()`. |
| **15** | Appel `GET /health` | Vérifie la sonde de santé ORM et le retour `{"statut": "ok", "environnement": "local"}`. |
| **16** | Appel `GET /docs` et fichiers statiques | Vérifie que Swagger UI est servi localement (`200 OK`, MIME JS/CSS corrects, zéro `cdn.jsdelivr.net`). |
