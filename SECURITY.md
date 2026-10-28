# Politique de sécurité / Security policy

## Signaler une vulnérabilité / Reporting a vulnerability

Ne publiez pas de faille dans une issue publique. Utilisez **Security → Report a vulnerability** sur la page GitHub du dépôt (signalement privé). Indiquez la version ou le commit, les étapes pour reproduire et l'impact. Vous recevrez une réponse sous quelques jours.

Please do not open a public issue for a vulnerability. Use **Security → Report a vulnerability** on the GitHub repository page (private report) and include the version or commit, steps to reproduce and the impact.

Seule la dernière version de la branche `main` est maintenue. / Only the latest `main` is supported.

## Ce que l'application protège / What is protected

- Mots de passe hachés avec bcrypt (coût 12). Sessions à jeton aléatoire stocké haché, cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en HTTPS), expiration à 24 h et après 4 h d'inactivité, révocation au changement de mot de passe.
- Requêtes d'écriture acceptées uniquement depuis l'origine de `APP_URL` (protection CSRF). Autorisations contrôlées côté serveur dans l'API : administrateur pour modèles, dossiers, utilisateurs et paramètres ; documents limités à leur propriétaire.
- Mot de passe SMTP chiffré en AES-256-GCM dans PostgreSQL ; la clé (`SETTINGS_ENCRYPTION_KEY`) reste dans l'environnement et n'est jamais renvoyée au navigateur.
- Limitation du débit sur la connexion, la récupération de mot de passe et l'envoi d'e-mails.
- PDF importés validés, stockés sous un nom aléatoire hors de la racine web ; chemins de fichier validés.

## À faire avant une mise en production / Before going to production

1. Servir l'application en **HTTPS** derrière un reverse proxy, et renseigner `APP_URL` avec l'origine exacte (`https://…`).
2. Générer une clé `SETTINGS_ENCRYPTION_KEY` propre (32 octets hexadécimaux), ne jamais la versionner, la sauvegarder séparément de la base.
3. Utiliser un PostgreSQL dédié avec un mot de passe fort. `npm run db:local` ne sert qu'au développement local.
4. Créer le premier administrateur avec `npm run admin:create -- <identifiant>` ; ne pas réutiliser de mot de passe de test.
5. Utiliser des identifiants SMTP propres au projet.
6. Sauvegarder PostgreSQL (`pg_dump`) et `storage/templates`.

## Limites connues / Known limitations

- La limitation de tentatives de connexion est **par identifiant**, pas par adresse IP : un tiers peut bloquer temporairement un compte (5 minutes) en multipliant les essais. Ajoutez une limitation par IP au niveau du reverse proxy.
- Un administrateur peut configurer n'importe quel hôte SMTP : l'application fera une connexion sortante vers cet hôte. Ne donnez le rôle administrateur qu'à des personnes de confiance.
- Aucune politique CSP complète sur les scripts (Next.js injecte des scripts en ligne) ; seules les directives sans impact (`frame-ancestors`, `base-uri`, `form-action`, `object-src`) sont définies.
- Un PDF rempli est une version modifiée : les signatures numériques préexistantes ne restent pas valides.
