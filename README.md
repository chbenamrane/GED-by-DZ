# GED By DZ

[![CI](https://github.com/chbenamrane/GED-by-DZ/actions/workflows/ci.yml/badge.svg)](https://github.com/chbenamrane/GED-by-DZ/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Turn PDF documents into reusable forms.** Import a PDF once, place fields on any page with a visual editor, then fill in the form as many times as you need and get a finished PDF with the original pages, sizes and orientations untouched.

> Français : [README.fr.md](README.fr.md)

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [PDF fidelity](#pdf-fidelity)
- [E-mail](#e-mail)
- [Roles and permissions](#roles-and-permissions)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Features

**Templates (administrators)**

- Import a PDF (10 MB max), then activate, deactivate, rename, recolor or delete it.
- Templates are shown as compact tiles grouped by folder. Drag a tile onto a folder to move it.
- Multi-page visual editor: place and move fields and checkboxes, zoom, native coordinates in millimetres, duplicate fields, test PDF. A new field is ready to rename as soon as you add it.
- Field types: text, long text, number, date, rating (1–5), list and checkboxes, with default values, limits, required flag, bold text and background clearing.

**Documents (everyone)**

- "New document" opens a modal listing the active templates by collapsible folder.
- The form shows a **live PDF preview** that updates while you type.
- Generate several documents in one go. "Generate" saves them, "Generate and download" saves and downloads, then you land back on the document list.
- Document list: view, share by e-mail, download, duplicate and delete, plus search, filter by template and statuses.
- Bulk actions: ZIP download and e-mail with PDF attachments.

**Administration**

- User accounts with administrator and user roles, recovery e-mail addresses.
- SMTP settings (the password is encrypted) and a test e-mail.
- Password recovery by e-mail with a single-use temporary link; sessions with idle and absolute timeouts.

## Tech stack

Next.js (App Router) · Node.js · PostgreSQL · Prisma · Tailwind CSS · TypeScript · pdf-lib (generation) · PDF.js (rendering) · Nodemailer · SweetAlert2 · Zod.

The app runs its own Node.js server and API. There is no external service to configure besides PostgreSQL and, optionally, an SMTP server.

## Quick start

Requirements: **Node.js 22.12+** and **PostgreSQL 17**.

```bash
git clone https://github.com/chbenamrane/GED-by-DZ.git
cd GED-by-DZ
npm ci
```

Then choose one of the two database setups.

**A. Use your own PostgreSQL** (any OS)

1. Create an empty database and a dedicated role.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `SETTINGS_ENCRYPTION_KEY` (see [Configuration](#configuration)).
3. Apply the schema:

```bash
npm run db:generate
npm run db:deploy
```

**B. Let the project create a local PostgreSQL** (Windows, PostgreSQL 17 installed in `C:\Program Files\PostgreSQL\17`)

```powershell
npm run db:local      # creates storage/postgres on 127.0.0.1:55432 and writes .env with random secrets
npm run db:generate
npm run db:deploy
```

Run `npm run db:local` again after every reboot to start that database. It is meant for local development only.

Create the first administrator (the password is asked at the prompt: 8+ characters with a letter and a digit), then start the app:

```bash
npm run admin:create -- my_admin
npm run dev
```

Open **http://localhost:3000**. Use `localhost`, not `127.0.0.1`: the browser origin must match `APP_URL` exactly, otherwise write requests are refused with "Origine de la requête refusée".

## Configuration

Everything is configured through environment variables in `.env` (never committed).

| Variable                  | Required | Description                                                                                                                                     |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | yes      | PostgreSQL connection string, for example `postgresql://ged:change-me@localhost:5432/ged_by_dz?schema=public`.                                  |
| `APP_URL`                 | yes      | Exact origin used in the browser, for example `http://localhost:3000`. Used for recovery links and CSRF protection.                             |
| `SETTINGS_ENCRYPTION_KEY` | yes      | 32 bytes as 64 hex characters, encrypts the SMTP password. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STORAGE_DIR`             | no       | Where template PDFs are stored. Default `./storage`.                                                                                            |
| `PDF_FONT_PATH`           | no       | A Unicode font for generated PDFs. Defaults to Arial on Windows, DejaVu Sans on Linux, then Helvetica.                                          |

Keep `SETTINGS_ENCRYPTION_KEY` safe and back it up separately from the database: without it the stored SMTP password cannot be decrypted.

## Scripts

| Command                | What it does                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run dev`          | Development server on `127.0.0.1:3000`.                                   |
| `npm run build`        | Production build.                                                         |
| `npm start`            | Production server on `127.0.0.1:3000`.                                    |
| `npm run typecheck`    | TypeScript check.                                                         |
| `npm test`             | Domain tests (fields, PDF geometry, bcrypt compatibility, encryption).    |
| `npm run test:e2e`     | Browser and API end-to-end scenario (needs the app and database running). |
| `npm run db:generate`  | Generate the Prisma client.                                               |
| `npm run db:deploy`    | Apply database migrations.                                                |
| `npm run db:local`     | Create or start the isolated local PostgreSQL (Windows).                  |
| `npm run admin:create` | Create an administrator account.                                          |
| `npm run format`       | Format the code with Prettier.                                            |
| `npm run video`        | Render the presentation videos (needs Microsoft Edge and FFmpeg).         |

## Project structure

```text
src/app/            Pages (App Router) and the API in src/app/api/[...path]/route.ts
src/components/     Workspace screens, PDF editor, PDF preview, modal, login forms
src/lib/            Security, PDF engine, field validation, mail, storage, client helpers
prisma/             Schema and SQL migrations
scripts/            Admin, local database, end-to-end tests, presentation tools
tests/              Domain tests
docs/               Presentation scripts
storage/            Template PDFs and local data (not versioned)
```

## PDF fidelity

The engine edits the source PDF with `pdf-lib`: every page, its size, crop boxes and rotation are kept, with no implicit conversion to A4. The browser preview (PDF.js) shares the same visible coordinates. Encrypted PDFs must be exported without protection before import. Limits: 10 MB per template, 100 documents per bulk request.

A filled PDF is a modified version: existing digital signatures cannot stay valid. Saving a document does not keep a binary copy of the original.

## E-mail

Configure SMTP from the **Settings** page. Without it, e-mail delivery and password recovery are unavailable. The SMTP password is encrypted with AES-256-GCM, never sent back to the browser, and e-mail sending is rate limited per user. End-to-end tests use a local fake SMTP server and send nothing outside.

## Roles and permissions

- **Administrator:** templates, folders, users and settings, and access to every document.
- **User:** creates and manages their own documents only.

Permissions are enforced on the server in the API, not only in the interface.

## Testing

```bash
npm run db:generate
npm run typecheck
npm test
npm run build
npm start
# in another terminal, with the app and database running:
npm run test:e2e
```

The end-to-end scenario creates synthetic accounts and PDFs and removes them afterwards. It uses Microsoft Edge on Windows, writes screenshots and a report to `storage/qa` (ignored by Git), and temporarily replaces the SMTP settings before restoring them, so run it on a development database. GitHub Actions runs install, Prisma generation, type check, tests, build and a dependency audit on every push and pull request, with no secrets.

## Deployment

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm start
```

Use a dedicated PostgreSQL, a persistent storage directory writable by the Node.js process, an HTTPS reverse proxy and a process supervisor. Set `APP_URL` to the public HTTPS origin: session cookies then get the `Secure` flag and HSTS is sent. Back up PostgreSQL with `pg_dump`, `storage/templates` and the encryption key separately.

## Security

See [SECURITY.md](SECURITY.md) for the security model, the production checklist, known limitations and how to report a vulnerability privately. Never publish your `.env`, template PDFs or real data.

## Contributing

Issues and pull requests are welcome. Before opening a pull request:

1. Run `npm run typecheck`, `npm test` and `npm run build`.
2. Format your changes with `npm run format`.
3. Keep commits small, one logical step each, with a short imperative subject line.
4. Do not commit `.env`, passwords, real data, PDF templates or generated files.

## License

[MIT](LICENSE) © Chams eddine BENAMRANE
