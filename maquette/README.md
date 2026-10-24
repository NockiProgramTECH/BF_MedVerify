# BF-MedVerify — maquette de pilotage

Maquette **HTML / CSS / JS** (aucun framework, aucune dépendance réseau) de l'écosystème
BF-MedVerify : site public de présentation, back-office régulateur Faso FDA et portails des
partenaires (pharmacies, laboratoires).

Le code applicatif réel (FastAPI + SQLAlchemy + httpSMS) reste à la racine du dépôt.
Ce dossier est autonome : il ne l'appelle jamais. Toutes les données affichées sont **fictives**.

---

## Ouvrir la maquette

Directement dans le navigateur :

```
maquette/index.html
```

Un double-clic suffit (protocole `file://`). Pour un rendu identique à l'hébergement :

```bash
cd maquette
python3 -m http.server 8000
# http://localhost:8000
```

Aucune compilation, aucun `npm install`, aucune connexion : les polices sont celles du
système, les icônes sont des SVG inline, les formulaires répondent par des toasts de démonstration.

---

## Les 17 pages

### Site public (4)

| Page | Contenu |
| --- | --- |
| `index.html` | Héros animé (pharmacienne, patiente, boîte, carte « AUTHENTIQUE »), problème, les 3 étapes, les 4 verdicts, le SMS, l'écosystème, la confidentialité, la FAQ, l'appel à l'action |
| `verifier.html` | Simulateur de vérification : saisie du code, fil de SMS reconstitué, 6 scénarios cliquables (authentique, déjà utilisé, expiré, révoqué, révoqué limite, mal écrit) |
| `ecosysteme.html` | Acteurs et rôles (RACI), hub des 6 interfaces, feuille de route, risques, contact |
| `design-system.html` | Jetons de couleur, typographie, composants, icônes, personnages, accessibilité, inventaire des pages |

### Back-office régulateur (11) — `app/`

| Page | Contenu |
| --- | --- |
| `app/index.html` | Tableau de bord : 87 312 vérifications / 7 j, 3 alertes critiques, courbe 14 jours, répartition des verdicts, dernières activités |
| `app/alertes.html` | File d'alertes, filtres par gravité, 5 tiroirs d'enquête, création d'alerte |
| `app/verifications.html` | Journal des vérifications, recherche, détail d'une vérification |
| `app/medicaments.html` | Catalogue produits / lots / codes, onglets, tiroirs lot et nouveau lot |
| `app/pharmacies.html` | 384 officines (352 actives, 24 en attente, 8 suspendues), tiroirs officine et création |
| `app/territoire.html` | Carte du Burkina (13 villes), volumes, couverture, zones sous-desservies |
| `app/sms.html` | Passerelle httpSMS : trafic, latence, secrets, tiroir de configuration |
| `app/rapports.html` | Rapports périodiques, export, tiroir de génération |
| `app/utilisateurs.html` | 68 comptes, rôles, invitations, journal d'audit |
| `app/parametres.html` | Réglages généraux, seuils d'alerte, anti-spam, notifications |
| `app/aide.html` | FAQ, raccourcis clavier, glossaire, statut des services, lien vers la documentation technique |

### Portails partenaires (2) — `app/`

| Page | Contenu |
| --- | --- |
| `app/portail-pharmacie.html` | Vérification rapide au comptoir, tâches du jour, stock et péremptions, courbe 14 jours, signalement, formation |
| `app/portail-laboratoire.html` | Lots déclarés, répartition des codes (donut), signalements, documents AMM, déclaration de lot |

---

## Organisation des fichiers

```
maquette/
├── index.html · verifier.html · ecosysteme.html · design-system.html
├── app/                    # 11 pages régulateur + 2 portails
│   ├── index.html · alertes.html · verifications.html · medicaments.html
│   ├── pharmacies.html · territoire.html · sms.html · rapports.html
│   ├── utilisateurs.html · parametres.html · aide.html
│   ├── portail-pharmacie.html · portail-laboratoire.html
├── assets/
│   ├── css/base.css        # jetons, typographie, boutons, badges, champs, en-têtes
│   ├── css/app.css         # coque dashboard, KPI, panneaux, tableaux, tiroirs, grilles
│   ├── css/site.css        # pages publiques, simulateur, hub, carte, design system
│   ├── js/layout.js        # 67 icônes SVG, coque, sidebar, palette Ctrl-K, toasts, reveals
│   ├── js/app.js           # filtres, recherche, pagination, tiroirs, onglets, graphiques
│   ├── js/site.js          # simulateur de vérification, animations publiques
│   └── img/                # logo, favicon, carte du Burkina générée
└── tools/                  # outillage de contrôle (Node, hors livraison)
    ├── generate_map.py     # régénère assets/img/carte-burkina.svg et carte-mini.svg
    ├── check.js            # contrôle structurel des 17 pages
    └── interactions.js     # tests d'interaction (filtres, tiroirs, palette, simulateur)
```

---

## Principes de design

- **Palette** inspirée du drapeau burkinabè, volontairement sobre et sans dégradé :
  vert `#08351f` / `#0e5535` / `#146b44`, or `#e6b41c` (+ `#8a650c` pour le texte sur fond clair),
  rouge `#a11f27`, papier `#fcfaf5`, sable `#f2ede2`, encre `#14241b`.
- **Contrastes** vérifiés : vert 8,5:1, rouge 7,35:1, or foncé 4,7:1 sur fond papier.
- **Responsive** : coque qui se replie en tiroir sous 980 px, tableaux défilants, grilles 12 → 6 → 1 colonne.
- **Motion design** discret : révélation au défilement, compteurs animés, scène du héros
  (main qui gratte, code qui se révèle, téléphone qui valide), bulles SMS,
  respect de `prefers-reduced-motion`.
- **Zéro réseau** : aucune requête sortante, aucune police distante, tous les états sont simulés.

---

## Vérifications automatisées

Les scripts s'exécutent hors navigateur et pointent sur les 17 pages :

```bash
cd maquette/tools
npm install          # une seule fois (jsdom + html-validate)
npm run html         # conformité HTML (balises, attributs, ARIA, boutons sans texte)
npm run check        # structure : coque, nav active, icônes, graphiques, erreurs JS
npm run interactions # filtres, recherche, tiroirs, Échap, palette, onglets, simulateur
npm test             # check + interactions
```

Dernier passage : **HTML valide sur les 17 pages**, **17/17 pages OK**,
**tous les tests d'interaction passent**.

---

## Régénérer la carte

`assets/img/carte-burkina.svg` et `carte-mini.svg` sont produits par `tools/generate_map.py`
à partir des frontières administratives (GeoJSON public) et d'un jeu de volumes fictif
(13 villes, 12 480 vérifications / jour). Le script reste dans le dossier pour la maintenance ;
les SVG livrés sont autonomes et n'ont pas besoin d'être régénérés.

---

## Données et avertissement

Tous les chiffres, noms d'officines, comptes et alertes sont **inventés** pour la démonstration.
Les codes de test (`BF7K2M9Q4XZ`, `BF3T8N5R2W5`, `BFH4P7V2KDG`, `BF9C6B3Z8M4`, `BF5J7Y2N4T8`)
ne correspondent à aucune base réelle. Le fonctionnement métier complet est décrit dans
[`../DOCUMENTATION_TECHNIQUE.md`](../DOCUMENTATION_TECHNIQUE.md).
