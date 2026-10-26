# GED By DZ

Migration du générateur de documents vers Next.js, Node.js, PostgreSQL, Tailwind CSS et Prisma. Le projet PHP reste séparé dans `../ged`.

Les modèles PDF conservent leurs dimensions originales. Aucun fichier client ni compte réel ne doit être versionné.

## Développement

Node.js 22.12+ et PostgreSQL 17+. Copier `.env.example` en `.env`, renseigner une base dédiée, puis :

```sh
npm install
npm run db:generate
npm run db:deploy
npm run dev
```

La migration est construite par étapes, avec un commit après chaque jalon vérifié.
