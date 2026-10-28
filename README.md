# GED By DZ

Application de transformation des documents PDF en formulaires réutilisables. Stack : **Next.js App Router, Node.js, PostgreSQL, Tailwind CSS et Prisma**, avec TypeScript. Le dépôt PHP historique reste séparé dans `../ged`. Cette application utilise son propre serveur Node.js.

## Démarrage Windows

Prérequis : Node.js 22.12+ et PostgreSQL 17 installé dans `C:\Program Files\PostgreSQL\17`.

```powershell
git clone https://github.com/chbenamrane/GED-by-DZ.git
cd GED-by-DZ
npm ci
npm run db:local
npm run db:generate
npm run db:deploy
npm run admin:create -- mon_admin
npm run dev
```

Ouvrir **http://localhost:3000** (et non `127.0.0.1` : l’origine doit correspondre exactement à `APP_URL`). Aucun mot de passe n’est stocké dans ce dépôt.

Reprise facultative d’une ancienne version PHP : voir [docs/MIGRATION.md](docs/MIGRATION.md). L’import conserve les identifiants, les rôles et les mots de passe bcrypt des comptes existants.

`db:local` crée une instance PostgreSQL indépendante dans `storage/postgres`, sur `127.0.0.1:55432`, sans modifier le service existant. Les identifiants aléatoires et la clé de chiffrement SMTP restent uniquement dans `.env`, exclu de Git. Relancer cette commande après un redémarrage du poste pour remettre cette instance en route.

Pour utiliser votre propre PostgreSQL : copier `.env.example` vers `.env`, renseigner une base dédiée dans `DATABASE_URL` et une clé de 32 octets hexadécimaux dans `SETTINGS_ENCRYPTION_KEY`, puis lancer `db:generate` et `db:deploy`. Ne pas utiliser `db:local` dans ce cas. La base et le rôle doivent déjà exister.

`npm run admin:create -- mon_admin` demande le mot de passe à l’invite (8 caractères minimum, avec une lettre et un chiffre).

## Fonctions

- Connexion, déconnexion, sessions avec limites d’inactivité et de durée ; rôles administrateur et utilisateur.
- Récupération par e-mail avec lien temporaire à usage unique ; changement de mot de passe et révocation des sessions.
- Import PDF validé, activation/désactivation, renommage, couleur et classement par dossier.
- Éditeur visuel multipage : placement et déplacement des champs et des cases, zoom, coordonnées natives en millimètres, duplication et PDF test.
- Texte, texte long, nombre, date, note 1–5, liste et cases à cocher ; valeurs par défaut, limites, caractère obligatoire, gras et effacement du fond.
- Formulaires, duplication d’un document existant, génération multiple, enregistrement seul ou téléchargement.
- Historique, recherche, filtre par modèle, statuts, suppression, PDF individuel, ZIP et e-mail avec pièces jointes.
- Gestion des comptes et des adresses de récupération ; paramètres SMTP et e-mail de test.
- Import transactionnel des JSON PHP et copie des modèles PDF, avec validation préalable et garde contre les doubles imports.

Les documents sont accessibles uniquement à leur propriétaire et aux administrateurs. Les contrôles sont exécutés dans les API. Un modèle supprimé disparaît de la création de documents mais reste disponible pour les documents historiques.

## Fidélité PDF

Le moteur modifie le PDF source avec `pdf-lib` : toutes les pages, leurs dimensions, leurs boîtes de recadrage et leurs rotations sont conservées, sans conversion implicite en A4. L’aperçu PDF.js partage les mêmes coordonnées visibles. Les PDF chiffrés doivent être exportés sans protection avant import. Taille maximale : 10 Mo ; génération/export groupés : 100 documents par requête.

Les anciens modèles calibrés sur A4 passent en coordonnées natives à l’import, sans changer le fichier source. Les placements historiques restent sur la première page ; de nouveaux champs peuvent être placés sur toutes les pages.

Configurer `PDF_FONT_PATH` pour une police Unicode spécifique. Sous Windows, Arial est détectée ; sous Linux, DejaVu Sans est essayée. Le secours Helvetica reste limité à son jeu de caractères. Un PDF rempli est une version modifiée : les signatures numériques préexistantes ne peuvent pas rester valides après modification. L’enregistrement n’est pas une copie binaire de l’original.

## E-mail et environnement

Renseigner le SMTP depuis Paramètres. Son mot de passe est chiffré en AES-256-GCM dans PostgreSQL ; la clé reste dans l’environnement. Aucun mot de passe SMTP n’est renvoyé au navigateur. Sans SMTP configuré, l’envoi réel et la récupération par e-mail ne sont pas disponibles. Les tests utilisent un serveur fictif local et n’envoient aucun message externe.

`APP_URL` doit correspondre exactement à l’origine utilisée dans le navigateur, par exemple `http://localhost:3000`. Elle sert aux liens de récupération et au contrôle des requêtes d’écriture. En HTTPS, les cookies de session sont marqués `Secure`.

## Vérifications

```powershell
npm run db:generate
npm run typecheck
npm test
npm run build
npm start
# Dans un autre terminal, application et base démarrées :
npm run test:e2e
```

Tests de domaine : formats mixtes, rotations, recadrages, champs, bcrypt PHP et chiffrement SMTP. Tests de bout en bout : accès, PDF, ZIP, dossiers, SMTP local, rendu et déplacement des champs dans le navigateur, formulaires, mobile, connexion et récupération. Les comptes et PDF synthétiques sont supprimés après le scénario. Celui-ci utilise Microsoft Edge sur Windows ; ses captures et son rapport restent dans `storage/qa`, ignoré par Git. Utiliser une base de développement sans utilisateurs concurrents : les réglages SMTP sont temporairement remplacés puis restaurés.

GitHub Actions exécute installation, génération Prisma, vérification TypeScript, tests de domaine et build, sans secrets de production.

## Livraison

```powershell
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm start
```

Configurer `.env`, PostgreSQL et un stockage persistant accessible au processus Node.js. En production, utiliser un reverse proxy HTTPS et un superviseur de processus. `.htaccess` bloque l’exposition directe du code et de `storage` par Apache/XAMPP ; l’application est servie par Node.js.

Sauvegarder PostgreSQL avec `pg_dump`, `storage/templates` et la clé de chiffrement séparément. Données réelles, `.env`, modèles PDF, `node_modules` et builds ne sont jamais versionnés.

Voir [docs/MIGRATION.md](docs/MIGRATION.md) pour la correspondance des données et le suivi.

## Sécurité

Voir [SECURITY.md](SECURITY.md) : modèle de sécurité, liste de contrôle avant mise en production, limites connues et signalement privé des vulnérabilités. Ne publiez jamais votre fichier `.env`, vos modèles PDF ni vos données réelles.

## Licence

[MIT](LICENSE).
