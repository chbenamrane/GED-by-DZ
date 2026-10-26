# Migration PHP → JavaScript

## Dépôts

- Source PHP : `C:\xampp\htdocs\ged`, commit de sauvegarde `fd009f1`.
- Nouvelle version : `C:\xampp\htdocs\GED-by-DZ`, dépôt indépendant.
- GitHub privé : https://github.com/chbenamrane/GED-by-DZ.
- Stack retenue : Next.js, Node.js, PostgreSQL, Tailwind CSS, Prisma.

## Correspondance

| Source                                | Destination                                                   |
| ------------------------------------- | ------------------------------------------------------------- |
| `db/users.json`                       | `User`, ID `legacy-user-{id}`, bcrypt inchangé                |
| `db/folders.json`                     | `Folder`, ID conservé                                         |
| `db/templates.json`                   | `Template`, champs validés, dimensions et rotations par page  |
| `templates_pdf`                       | Copie dans `storage/templates`, original inchangé             |
| `db/documents.json`                   | `Document`, ID `legacy-doc-{id}`, auteur et statuts conservés |
| `db/settings.json`                    | `Setting`, mot de passe SMTP chiffré s’il existe              |
| Sessions et liens de récupération PHP | Non repris ; nouvelle connexion ou nouveau lien nécessaire    |

Les fichiers SMTP externes et variables d’environnement PHP ne sont pas importés automatiquement. Les renseigner dans la nouvelle application si nécessaire.

## Import

```powershell
npm run db:import -- --source=C:\xampp\htdocs\ged
npm run db:import -- --source=C:\xampp\htdocs\ged --apply
```

Par défaut, le script contrôle JSON, relations, PDF et coordonnées sans écrire. `--apply` copie les PDF puis importe dans une transaction PostgreSQL. En cas d’échec, les nouvelles copies sont retirées. Le contenu des JSON et PDF détermine l’empreinte : un instantané déjà importé est ignoré. Les comptes existants de même identifiant de connexion sont conservés et ne sont pas écrasés.

L’import est une reprise initiale, pas une synchronisation. Les modifications ultérieures dans PHP ne se propagent pas dans Next.js. Avant une bascule de production, arrêter les écritures PHP et préparer une reprise finale sur une base dédiée. Ne pas réinitialiser une base contenant des données utiles.

## Étapes versionnées

1. Sauvegarde du projet PHP et des corrections PDF.
2. Initialisation du dépôt et du socle Next.js/Tailwind/Prisma.
3. Modèle PostgreSQL, API, authentification, autorisations et moteur PDF.
4. Interface, formulaires, administration et éditeur multipage.
5. Migration SQL et reprise transactionnelle des données historiques.
6. Tests navigateur/SMTP, corrections de rendu, protection du stockage et documentation.

La version PHP reste disponible ; l’import ne modifie pas ses données. Choisir un seul outil pour les nouveaux documents lors de la bascule, puisque les bases évoluent indépendamment.
