# GED By DZ — vidéos de présentation

Deux versions de **56 secondes**, en français et en anglais. Format 16:9, 1280 × 720, 30 images/seconde, WebM avec piste audio Opus. Motion graphics originaux aux couleurs du projet : vert, bleu encre et fond clair. Interfaces illustrées, sans captures ni données réelles. Effets sonores synthétisés : transitions, touches de saisie et signature finale. Pas de musique ni de voix de synthèse provisoire.

## Fichiers et reproduction

- Français : `storage/presentation/ged-by-dz-fr.webm`
- Anglais : `storage/presentation/ged-by-dz-en.webm`
- Vérification : `node scripts/check-presentation.mjs` (lecture, durée, dimensions, piste audio et captures).
- Générateur : `node scripts/render-presentation.mjs` (Microsoft Edge et dépendances npm installés).

Les vidéos sont générées localement et exclues de Git. Le rendu prend quelques minutes. La voix off est à ajouter au montage, en conservant les effets sonores. Export final conseillé : MP4 H.264, audio AAC, 1280 × 720, durée de 56 secondes. Avec FFmpeg disponible, un exemple de mixage figure ci-dessous. Les voix doivent être calées aux repères indiqués, avec de courtes pauses entre les séquences.

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

Avec une piste `voice-fr.wav` déjà calée sur les 56 secondes, exécuter depuis la racine du dépôt :

```powershell
ffmpeg -i storage/presentation/ged-by-dz-fr.webm -i storage/presentation/voice-fr.wav -filter_complex "[0:a]volume=0.4[sfx];[sfx][1:a]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v:0 -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -t 56 -movflags +faststart storage/presentation/ged-by-dz-fr-final.mp4
```

Remplacer `fr` par `en` pour la version anglaise. Écouter le résultat pour ajuster le niveau des effets sous la voix. L’envoi par e-mail présenté nécessite une configuration SMTP dans l’application.
