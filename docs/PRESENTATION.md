# GED By DZ — vidéos de présentation

Deux versions de **56 secondes**, en français et en anglais. Format 16:9, 1920 × 1080, 30 images/seconde, MP4 H.264 avec audio AAC. Motion graphics aux couleurs du projet (écrans illustrés avec des données fictives), sept séquences de 8 secondes : import, éditeur, génération, historique, formats et droits, signature. Bande son : effets sonores synthétisés (clics, frappes, transitions, cloche de validation) et fond musical discret. La voix off est à ajouter.

## Fichiers et reproduction

- `storage/presentation/ged-by-dz-fr.mp4` et `ged-by-dz-en.mp4` : vidéos avec effets et fond musical, sans voix.
- `storage/presentation/sfx-fr.wav` et `sfx-en.wav` : la bande son seule, pour un montage externe.
- Rendu : `npm run video` (ou `node scripts/video/render.mjs fr` / `en`). Nécessite Microsoft Edge et FFmpeg ; environ une minute par langue.
- Sources : `scripts/video/scene.html` (animation, textes, repères sonores), `scripts/video/audio.mjs` (synthèse sonore), `scripts/video/render.mjs` (capture et encodage).
- Images fixes de contrôle : `node scripts/video/render.mjs fr --stills 5,20,45 --out <dossier>`.

Les vidéos sont générées localement et exclues de Git.

## Direction vocale

Voix chaleureuse, claire et professionnelle. Ton explicatif, sans emphase publicitaire. Débit : environ 150 à 165 mots par minute pendant les phrases ; ajuster chaque segment à son créneau. Prononcer « GED By DZ » : « G E D, by D Z » en anglais ; « G E D, by D Z » avec les lettres françaises en français. Ne pas lire les minutages. Livrer un WAV mono ou stéréo, 48 kHz, sans musique, sans effets et sans saturation. Respecter une durée maximale de 56 secondes, avec une fin de voix avant 55 secondes.

Pour un calage précis, générer sept segments séparés de moins de 7 secondes, puis les placer à 0,5 ; 8,5 ; 16,5 ; 24,5 ; 32,5 ; 40,5 et 48,5 secondes. Les réunir dans une piste WAV de 56 secondes, en conservant les silences.

## Script français

| Début | Fin de séquence | Voix off                                                                                                              |
| ----- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| 00:00 | 00:08           | Découvrez GED By DZ. Transformez vos PDF en formulaires réutilisables et simplifiez la création documentaire.         |
| 00:08 | 00:16           | Importez vos modèles et classez-les par dossier pour retrouver facilement le bon document.                            |
| 00:16 | 00:24           | Placez textes, dates et cases à cocher sur toutes les pages, dans l’éditeur visuel.                                   |
| 00:24 | 00:32           | Remplissez votre formulaire, puis générez un PDF ou plusieurs documents en une seule fois.                            |
| 00:32 | 00:40           | Retrouvez vos créations dans l’historique. Téléchargez vos PDF, exportez un ZIP ou envoyez-les par e-mail.            |
| 00:40 | 00:48           | Préservez les pages, dimensions et orientations de vos PDF. Chaque utilisateur accède aux documents selon ses droits. |
| 00:48 | 00:56           | GED By DZ. Du PDF au formulaire, du formulaire au document. Créez, réutilisez, simplifiez.                            |

### Texte français à copier

Découvrez GED By DZ. Transformez vos PDF en formulaires réutilisables et simplifiez la création documentaire.

Importez vos modèles et classez-les par dossier pour retrouver facilement le bon document.

Placez textes, dates et cases à cocher sur toutes les pages, dans l’éditeur visuel.

Remplissez votre formulaire, puis générez un PDF ou plusieurs documents en une seule fois.

Retrouvez vos créations dans l’historique. Téléchargez vos PDF, exportez un ZIP ou envoyez-les par e-mail.

Préservez les pages, dimensions et orientations de vos PDF. Chaque utilisateur accède aux documents selon ses droits.

GED By DZ. Du PDF au formulaire, du formulaire au document. Créez, réutilisez, simplifiez.

## English script

| Start | Scene end | Voice-over                                                                                              |
| ----- | --------- | ------------------------------------------------------------------------------------------------------- |
| 00:00 | 00:08     | Meet GED By DZ. Turn your PDFs into reusable forms and simplify the way you create documents.           |
| 00:08 | 00:16     | Import your templates and organize them into folders, so the right document is easy to find.            |
| 00:16 | 00:24     | Use the visual editor to place text fields, dates and checkboxes across the pages of your PDF.          |
| 00:24 | 00:32     | Fill in your form, then generate a finished PDF or create multiple documents in one go.                 |
| 00:32 | 00:40     | Find past documents in your history. Download PDFs, export a ZIP archive, or send documents by email.   |
| 00:40 | 00:48     | Keep your original pages, dimensions and orientations. Document access follows each user’s permissions. |
| 00:48 | 00:56     | GED By DZ. From PDF to form, from form to document. Create, reuse, simplify.                            |

### English copy-ready text

Meet GED By DZ. Turn your PDFs into reusable forms and simplify the way you create documents.

Import your templates and organize them into folders, so the right document is easy to find.

Use the visual editor to place text fields, dates and checkboxes across the pages of your PDF.

Fill in your form, then generate a finished PDF or create multiple documents in one go.

Find past documents in your history. Download PDFs, export a ZIP archive, or send documents by email.

Keep your original pages, dimensions and orientations. Document access follows each user’s permissions.

GED By DZ. From PDF to form, from form to document. Create, reuse, simplify.

## Intégration de la voix off

Avec `voice-fr.wav` calée sur 56 secondes dans `storage/presentation/`, depuis la racine du dépôt. La musique et les effets baissent automatiquement sous la voix :

```powershell
ffmpeg -i storage/presentation/ged-by-dz-fr.mp4 -i storage/presentation/voice-fr.wav -filter_complex "[1:a]asplit[v][sc];[0:a][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400[duck];[duck][v]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 256k -t 56 -movflags +faststart storage/presentation/ged-by-dz-fr-final.mp4
```

Remplacer `fr` par `en` pour la version anglaise. L'image n'est pas ré-encodée. L'envoi par e-mail présenté nécessite une configuration SMTP dans l'application.
