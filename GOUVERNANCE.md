# BF-MedVerify — Qui fait quoi, avec quels droits

> **À quoi sert ce document.** Répondre à une seule question, geste par geste : *qui a le droit de faire quoi, qui doit valider, et qui porte la responsabilité si ça se passe mal.*
> Version 1 — octobre 2026. À lire en 10 minutes ; les tableaux suffisent si tu es pressé.

---

## 1. L'essentiel en 30 secondes

Huit acteurs. Un seul principe : **personne ne cumule le pouvoir de fabriquer un code et celui de dire qu'il est vrai.**

| Acteur | Son rôle en une phrase | Ce qu'il ne peut **pas** faire |
| --- | --- | --- |
| **Citoyen / patient** | Vérifier une boîte par SMS et signaler un doute | Créer un compte, modifier une donnée, voir qui a fabriqué quoi |
| **Pharmacie** | Vérifier avant de délivrer, retirer un lot du rayon, signaler | Décider qu'un lot est faux, suspendre un lot, générer des codes |
| **Grossiste** | Importer, stocker, livrer, tracer les quantités | Vérifier « au nom » d'une pharmacie, modifier un lot déclaré |
| **Laboratoire (titulaire d'AMM)** | Déclarer ses lots, faire imprimer et poser les codes, répondre aux signalements | Valider lui-même son lot, générer les codes en base, suspendre un lot |
| **Faso FDA — régulateur** | Autoriser, qualifier les alertes, suspendre ou rappeler un lot | Générer des codes, imprimer, toucher au sceau technique |
| **Faso FDA — administrateur** | Gérer les comptes, les rôles, les paramètres, les exports sensibles | Contourner une double validation, effacer une trace d'audit |
| **Exploitant technique** | Faire tourner la plateforme, générer les codes sur ordre, sauvegarder | Décider du sort d'un lot, lire les codes en clair après impression |
| **Auditeur / bailleur** | Lire, contrôler, exporter des agrégats | Modifier quoi que ce soit |

### Les 4 règles d'or

1. **Celui qui génère les codes n'est pas celui qui les autorise.** Le laboratoire demande, la Faso FDA autorise, l'exploitant technique génère.
2. **Celui qui déclare un lot ne le valide pas.** Un agent FDA ne peut pas approuver un lot de sa propre structure (conflit d'intérêt → alerte).
3. **Rien ne se supprime.** Les statuts changent (`ACTIF` → `RAPPELE`), les lignes restent. Un journal d'audit horodaté garde tout.
4. **Deux personnes pour les gestes irréversibles** : suspension nationale d'un lot, rotation du sceau, export complet de la base.

---

## 2. La chaîne complète, étape par étape

| # | Étape | Qui agit | Ce qui est produit | Où c'est tracé |
| --- | --- | --- | --- | --- |
| 1 | **Homologuer le produit** | Ministère de la Santé / Faso FDA | Une AMM (autorisation de mise sur le marché) | Registre national des AMM |
| 2 | **Déclarer le lot** | Laboratoire titulaire | Produit, n° de lot, quantité, dates | `lot` en base · écran *Portail laboratoire* |
| 3 | **Autoriser la mise en circulation** | Faso FDA (régulateur) | Un accord signé sur le lot | Journal de validation · statut du lot |
| 4 | **Générer les codes** | Exploitant technique, **sur ordre écrit** | N codes à 11 caractères + leurs empreintes | `code_securite` (empreintes seules) + bon de génération |
| 5 | **Imprimer et poser la couche grattable** | Imprimeur agréé + laboratoire | Les boîtes physiques | Bon d'impression, quantité détruite, échantillons |
| 6 | **Mettre en circulation** | Grossiste | Bons de livraison, quantités par officine | Traçabilité de distribution |
| 7 | **Délivrer et vérifier** | Pharmacie (ou citoyen par SMS) | Un verdict enregistré, anonyme | `verification` · journal du back-office |
| 8 | **Surveiller** | Le dispositif (automatique) puis la Faso FDA (humain) | Des alertes brutes, puis qualifiées | `alerte` · écran *Alertes* |
| 9 | **Décider** | Faso FDA (administrateur + régulateur) | `RAPPELE`, retrait, communication | Statut du lot + note de décision |

> **Le point clé** : à l'étape 4, la base ne reçoit **que des empreintes** (HMAC-SHA256). Les codes en clair n'existent qu'une seule fois, dans `liste_codes.txt`, qui est imprimé puis détruit. Même l'exploitant technique ne peut pas reconstituer un code à partir de la base.

---

## 3. Fiches par acteur

### 3.1 Citoyen / patient
- **Mission** : transformer chaque achat en point de contrôle, sans application ni forfait data.
- **Droits** : envoyer `VERIF <code>` par SMS ; recevoir un verdict clair ; signaler une boîte douteuse ; recommencer autant de fois qu'il veut (limité à 5/minute).
- **Interdits** : pas de compte, pas d'espace personnel, pas d'accès aux données des autres, pas de consultation de l'inventaire national.
- **Ce qu'il voit** : uniquement la réponse à *son* code (produit, lot, expiration, conduite à tenir).
- **Ce qui est conservé** : l'empreinte de son numéro de téléphone (jamais le numéro en clair), le verdict, l'horodatage.
- **Écran** : `verifier.html` (simulateur) · parcours réel = SMS.

### 3.2 Pharmacie (officine et ses vérificateurs)
- **Mission** : dernier rempart avant la remise au patient.
- **Droits** : vérifier au comptoir (portail ou SMS) ; retirer un lot du rayon ; signaler une anomalie (boîte sans couche grattable, code illisible, doute) ; former ses vérificateurs ; consulter son propre historique.
- **Interdits** : suspendre un lot, qualifier une alerte, générer des codes, voir les données des autres officines, voir l'identité des patients.
- **Ce qu'elle voit** : ses vérifications, son stock, son taux de conformité, les rappels qui la concernent.
- **Obligation** : vérifier **avant** délivrance pour tout produit couvert ; confirmer le retrait d'un lot rappelé dans un délai imparti (ex. 24 h).
- **Écran** : `app/portail-pharmacie.html`.

### 3.3 Grossiste (import / distribution)
- **Mission** : acheminer sans casser la chaîne de traçabilité.
- **Droits** : consulter les lots qu'il distribue, enregistrer les mouvements (entrées/sorties), signaler une anomalie d'emballage.
- **Interdits** : déclarer un lot à la place du laboratoire, modifier une quantité déjà déclarée, accéder aux données des officines concurrentes.
- **Ce qu'il voit** : les lots qu'il a reçus, en lecture, avec leur statut (`ACTIF` / `RAPPELE`).
- **Obligation** : bloquer physiquement un lot dès qu'il passe en `RAPPELE` et remonter les quantités détenues.
- **Écran** : pas encore de portail dédié (à construire) — aujourd'hui : notification + échanges documentaires.

### 3.4 Laboratoire titulaire d'AMM
- **Mission** : déclarer ce qu'il fabrique, poser les codes, assumer la qualité de ses lots.
- **Droits** : créer un produit et un lot ; demander la génération d'un lot de codes ; téléverser ses documents (AMM, certificats) ; répondre à un signalement qui le concerne ; demander le rappel d'un lot.
- **Interdits** : s'auto-valider ; accéder au sceau (`BFMV_PEPPER`) ; écrire directement des empreintes en base ; voir les données des autres laboratoires ; suspendre un lot.
- **Ce qu'il voit** : ses produits, ses lots, ses codes (quantité imprimée / utilisée), les signalements qui le visent, ses échéances AMM.
- **Obligation** : déclarer un lot **avant** impression ; signaler toute rupture de chaîne ; répondre sous 48 h à un signalement critique.
- **Écran** : `app/portail-laboratoire.html`.

### 3.5 Faso FDA — régulateur (agent, inspecteur, qualificateur)
- **Mission** : protéger la population ; c'est le seul acteur qui peut arrêter un produit.
- **Droits** : autoriser un lot ; voir toutes les alertes ; qualifier une alerte (vraie / faux positif) ; suspendre un lot ; lancer un rappel national ; gérer les officines ; exporter des rapports ; vérifier un code.
- **Interdits** : générer des codes ; imprimer ; modifier une vérification passée ; valider un lot de sa propre structure ; supprimer une alerte.
- **Ce qu'il voit** : tout l'observatoire — volumes, verdicts, carte, alertes, officines, laboratoires.
- **Obligation** : qualifier toute alerte critique sous 24 h (48 h ouvrées pour les autres) ; motiver chaque décision par une note écrite.
- **Écran** : les 11 pages `app/` (régulateur).

### 3.6 Faso FDA — administrateur
- **Mission** : faire vivre le dispositif sans décider à la place des régulateurs.
- **Droits** : créer/suspendre des comptes ; attribuer les rôles ; modifier les seuils d'alerte ; gérer les paramètres ; lancer un export complet (avec double validation) ; faire tourner les clés.
- **Interdits** : qualifier une alerte à la place d'un régulateur (sauf délégation écrite et tracée) ; supprimer un compte sans conserver son historique ; désactiver l'audit.
- **Particularité** : c'est le seul rôle qui peut tout *configurer*, mais pas tout *décider*.
- **Écran** : `app/utilisateurs.html`, `app/parametres.html`.

### 3.7 Exploitant technique / hébergeur
- **Mission** : garder la plateforme debout, sûre, sauvegardée — sans jamais se substituer au régulateur.
- **Droits** : déployer, superviser, restaurer une sauvegarde, exécuter `generer_codes.py` sur bon de commande, faire tourner le sceau.
- **Interdits** : décider du statut d'un lot ; lire les codes en clair après remise à l'imprimeur ; consulter les numéros de téléphone (seulement des empreintes) ; modifier une ligne de vérification.
- **Obligation** : conserver le sceau dans un coffre (deux gardiens), journaliser chaque accès, sauvegarder quotidiennement, alerter sous 1 h en cas d'incident.
- **Écran** : `app/sms.html` (supervision du canal), `app/parametres.html` (technique).

### 3.8 Auditeur externe / bailleur
- **Mission** : vérifier que le dispositif tient ses promesses, sans le perturber.
- **Droits** : consulter le tableau de bord, les alertes, les rapports agrégés ; exporter des agrégats ; poser des questions écrites.
- **Interdits** : toute écriture ; tout accès nominatif ; toute extraction de données personnelles.
- **Durée** : accès daté (ex. 30 jours), révocable, journalisé.
- **Écran** : rôle « Auditeur (lecture seule) » dans `app/utilisateurs.html`.

---

## 4. Matrice de permissions

Légende : **✔** complet · **◐** lecture seule · **⚠** avec double validation · **—** interdit.

| Action | Citoyen | Pharmacie | Grossiste | Laboratoire | Régulateur FDA | Admin FDA | Exploitant | Auditeur |
| --- | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
| Vérifier un code | ✔ | ✔ | — | — | ✔ | ◐ | — | — |
| Consulter le tableau de bord | — | — | — | — | ✔ | ◐ | ◐ | ◐ |
| Voir ses propres lots | — | — | ◐ | ✔ | ✔ | ◐ | — | — |
| Voir tous les lots | — | — | — | — | ✔ | ◐ | — | ◐ |
| Déclarer un produit / un lot | — | — | — | ✔ | ✔ | — | — | — |
| Autoriser la mise en circulation | — | — | — | — | ✔ | — | — | — |
| Demander la génération des codes | — | — | — | ✔ | — | — | — | — |
| **Générer les codes (base)** | — | — | — | — | — | — | ⚠ | — |
| Imprimer la liste des codes | — | — | — | — | — | — | ⚠ | — |
| Voir toutes les alertes | — | — | — | ◐ (les siennes) | ✔ | ◐ | — | ◐ |
| Qualifier une alerte | — | — | — | — | ✔ | — | — | — |
| Signaler un produit | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Suspendre un lot | — | — | — | — | ✔ | — | — | — |
| Rappel national | — | — | — | — | ⚠ | ⚠ | — | — |
| Gérer les officines | — | — | — | — | ✔ | ◐ | — | — |
| Gérer les comptes et rôles | — | — | — | — | — | ✔ | — | — |
| Modifier les paramètres / seuils | — | — | — | — | — | ⚠ | ◐ | — |
| Export détaillé | — | — | — | — | ✔ | ⚠ | — | ◐ (agrégats) |
| Journal d'audit | — | — | — | — | ◐ | ◐ | ◐ | ◐ |

> Cohérente avec la matrice affichée dans `app/utilisateurs.html`, ici éclatée pour distinguer **Régulateur** et **Administrateur** — la maquette les regroupe sous « Régulateur ».

---

## 5. Les trois questions sensibles

### 5.1 Qui crée les codes ?

**Personne ne « crée » un code à la main.** Le code est produit par un générateur, en trois temps :

1. **Le laboratoire demande** un lot de N codes pour un lot de médicament déjà autorisé. Il ne voit jamais le générateur.
2. **L'exploitant technique exécute** `generer_codes.py lot <id> <N>` sur un bon de commande signé. Le script utilise le sceau secret (`BFMV_PEPPER`) pour calculer une empreinte HMAC-SHA256 par code.
3. **Seules les empreintes entrent en base.** Les codes en clair sont écrits dans `liste_codes.txt`, remis à l'imprimeur agréé, puis le fichier est détruit. Deux personnes signent la remise et la destruction.

**Conséquence** : si la base fuit, aucun code n'est utilisable. Si le sceau est perdu, tous les codes deviennent invérifiables — d'où la garde à deux clés.

### 5.2 Qui valide quoi ? (trois validations différentes)

| Validation | Qui | Sur quoi | Preuve |
| --- | --- | --- | --- |
| **Validation réglementaire** | Faso FDA (régulateur) | Le lot peut être mis en circulation | Accord signé + date |
| **Validation technique** | Exploitant + témoin | N codes générés = N boîtes prévues | Bon de génération + empreintes en base |
| **Validation terrain** | Pharmacie | La boîte remise correspond au code vérifié | Vérification horodatée |

Aucune de ces trois validations ne peut être faite par la même personne. C'est ce qui rend la fraude interne difficile.

### 5.3 Qui peut arrêter un produit ?

- **Seule la Faso FDA** change un statut en `RAPPELE` : le régulateur propose, l'administrateur contresigne si le rappel est national.
- **Le laboratoire peut demander** un rappel — il ne peut pas le prononcer.
- **La pharmacie peut retirer** une boîte du rayon immédiatement, sans autorisation : c'est un geste de prudence, pas une décision réglementaire. Elle doit le tracer.
- **Le dispositif automatique** ne suspend rien : il **alerte** (3 codes inconnus en 24 h, ou un même code vu par 3 téléphones différents). La décision reste humaine.

---

## 6. Ce qui existe déjà, ce qui reste à construire

| Fonction | État réel dans le code | À faire |
| --- | --- | --- |
| Génération des codes + empreintes HMAC | ✅ `bf_codes.py`, `generer_codes.py` | Interface web + double contrôle de génération |
| Vérification (API, SMS générique, webhook httpSMS) | ✅ `main.py` | — |
| Anti-spam (5/min) et verrouillage concurrent | ✅ `services.py` | — |
| Alertes automatiques (codes inconnus, code copié) | ✅ `services.py` | Notification SMS/e-mail aux régulateurs |
| Statuts lot / code | ✅ `ACTIF`/`RAPPELE`, `NON_UTILISE`/`UTILISE`/`REVOQUE` | API de suspension |
| **Comptes, rôles, permissions** | ❌ *maquette uniquement* | **Priorité 1 avant tout pilote réel** |
| **Journal d'audit** | ❌ | Priorité 1 (append-only, horodaté) |
| **Double validation** | ❌ | Priorité 2 |
| Portail laboratoire / pharmacie | ❌ *maquette uniquement* | Priorité 2 |
| Politique de conservation / purge | ❌ | À arbitrer (voir §7) |

> Autrement dit : **le cœur métier est solide, la couche « qui a le droit » reste à coder.** Aujourd'hui, l'API est protégée par une clé unique (`API_KEY`) et le webhook par une signature JWT — c'est une sécurité de service, pas encore une gestion d'utilisateurs.

---

## 7. Décisions à prendre (avec une recommandation)

| # | Question | Recommandation |
| --- | --- | --- |
| D1 | Qui garde `BFMV_PEPPER` ? | Coffre physique + deux gardiens (Faso FDA + exploitant). Rotation annuelle documentée. |
| D2 | Qui exécute la génération des codes ? | L'exploitant technique, sur bon de commande signé par la FDA. Jamais le laboratoire. |
| D3 | Qui autorise la mise en circulation d'un lot ? | La Faso FDA, une signature. Le laboratoire déclare, il n'autorise pas. |
| D4 | Qui prononce un rappel national ? | Administrateur FDA + un second signataire. Délai maximal de décision : 24 h. |
| D5 | Combien de temps garde-t-on les données ? | Empreintes et verdicts : 10 ans. Journaux techniques : 13 mois. Aucune donnée nominative. |
| D6 | Que voit un grossiste ? | Lecture seule des lots qu'il distribue, sans données des officines. |
| D7 | Le citoyen peut-il signaler sans compte ? | Oui, par SMS. Le signalement devient une alerte à qualifier, pas une preuve. |
| D8 | Que faire d'une alerte non qualifiée depuis 24 h ? | Escalade automatique à l'administrateur + mention « hors délai » (déjà affichée dans la maquette). |

**Ces huit décisions conditionnent la suite** : dès qu'elles sont tranchées, on peut transformer la maquette en interface réelle et écrire la couche d'authentification.

---

## 8. Lexique

| Terme | Définition |
| --- | --- |
| **AMM** | Autorisation de mise sur le marché : le droit de vendre un médicament, délivré par l'autorité nationale. |
| **Lot** | Groupe de boîtes fabriquées ensemble, identifié par un numéro (`BF-2291`). |
| **Code de sécurité** | 11 caractères sous la couche grattable, unique, sans `0/O/1/I/L` pour éviter les confusions. |
| **Empreinte (HMAC)** | Résultat d'un calcul irréversible à partir du code et d'un secret. La base ne stocke que ça. |
| **Sceau (`BFMV_PEPPER`)** | Le secret qui rend les empreintes impossibles à recalculer sans lui. Perdu = dispositif mort. |
| **Verdict** | La réponse du dispositif : `VRAI`, `DEJA_UTILISE`, `EXPIRE`, `REVOQUE`, `MAL_ECRIT`, `INCONNU`. |
| **Alerte** | Signal automatique à qualifier par un humain. Elle ne suspend rien par elle-même. |
| **RACI** | Grille de responsabilités : *Réalise*, *Approuve*, *Consulté*, *Informé*. |

---

*Document de travail — les rôles décrits ici sont une proposition de gouvernance, pas encore une contrainte technique du code. Il accompagne [`DOCUMENTATION_TECHNIQUE.md`](./DOCUMENTATION_TECHNIQUE.md) (fonctionnement du backend) et [`maquette/README.md`](./maquette/README.md) (les 17 écrans).*
