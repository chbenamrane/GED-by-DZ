import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Prisma } from '../src/generated/prisma/client';
import { db } from '../src/lib/db';
import { inspectPdf } from '../src/lib/pdf';
import { storePdf, removePdf } from '../src/lib/files';
import { fieldSchema, validateFields, type Field, type PageSize } from '../src/lib/fields';
import { encrypt } from '../src/lib/security';
type Row = Record<string, unknown>;
const root = path.resolve(
  process.argv.find((a) => a.startsWith('--source='))?.slice(9) ?? '../ged',
);
const apply = process.argv.includes('--apply');
function date(raw: unknown): Date {
  const s = String(raw ?? '');
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(s);
  if (!m) return new Date();
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}
async function rows(name: string) {
  try {
    const raw = JSON.parse(await readFile(path.join(root, 'db', `${name}.json`), 'utf8'));
    if (!Array.isArray(raw[name])) throw new Error(`Structure ${name} invalide.`);
    return raw[name] as Row[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}
async function main() {
  const [users, folders, templates, documents] = await Promise.all(
    ['users', 'folders', 'templates', 'documents'].map(rows),
  );
  const fingerprints = JSON.stringify({ users, folders, templates, documents });
  const prepared: { row: Row; bytes: Uint8Array; sizes: PageSize[]; fields: Field[] }[] = [];
  for (const t of templates) {
    const filename = String(t.filename ?? '');
    if (!filename || path.basename(filename) !== filename)
      throw new Error('Nom de fichier de modèle invalide.');
    const bytes = new Uint8Array(await readFile(path.join(root, 'templates_pdf', filename)));
    const sizes = await inspectPdf(bytes);
    const sx = t.coordinate_space === 'native' ? 1 : sizes[0].width / 210,
      sy = t.coordinate_space === 'native' ? 1 : sizes[0].height / 297;
    const rawFields = Array.isArray(t.fields) ? (t.fields as Row[]) : [];
    const fields: Field[] = rawFields.map((f) =>
      fieldSchema.parse({
        ...f,
        page: 0,
        x: Number(f.x ?? 0) * sx,
        y: Number(f.y ?? 0) * sy,
        max_width_mm: Number(f.max_width_mm ?? 0) * sx,
        options:
          f.type === 'checkbox'
            ? Array.isArray(f.options)
              ? (f.options as Row[]).map((o) => ({
                  ...o,
                  x: Number(o.x ?? 0) * sx,
                  y: Number(o.y ?? 0) * sy,
                }))
              : []
            : (f.options ?? []),
      }),
    );
    validateFields(fields, sizes);
    prepared.push({ row: t, bytes, sizes, fields });
  }
  for (const u of users) {
    if (!/^\$2[aby]\$/.test(String(u.password)))
      throw new Error('Un compte ne possède pas de mot de passe bcrypt valide.');
  }
  for (const d of documents) {
    if (!templates.some((t) => t.id === d.template_id))
      throw new Error('Un document référence un modèle absent.');
    if (d.user_id && !users.some((u) => u.id === d.user_id))
      throw new Error('Un document référence un utilisateur absent.');
  }
  const summary = {
    users: users.length,
    folders: folders.length,
    templates: templates.length,
    documents: documents.length,
    pdfPages: prepared.reduce((sum, t) => sum + t.sizes.length, 0),
  };
  console.log(
    JSON.stringify({ mode: apply ? 'APPLY' : 'DRY RUN', source: root, ...summary }, null, 2),
  );
  if (!apply) {
    console.log('Validation terminée. Pour importer : npm run db:import -- --apply');
    return;
  }
  const id = createHash('sha256')
    .update(root)
    .update(fingerprints)
    .update(prepared.map((t) => createHash('sha256').update(t.bytes).digest('hex')).join())
    .digest('hex');
  if (await db.importRun.findUnique({ where: { id } })) {
    console.log('Cet instantané a déjà été importé. Aucune modification.');
    return;
  }
  const created: string[] = [];
  try {
    const files = new Map<string, string>();
    for (const t of prepared) {
      const existing = await db.template.findUnique({ where: { id: String(t.row.id) } });
      if (!existing) {
        const name = await storePdf(t.bytes);
        created.push(name);
        files.set(String(t.row.id), name);
      }
    }
    await db.$transaction(
      async (tx) => {
        const userIds = new Map<unknown, string>();
        for (const u of users) {
          const user = await tx.user.upsert({
            where: { username: String(u.username) },
            update: {},
            create: {
              id: `legacy-user-${u.id}`,
              username: String(u.username),
              passwordHash: String(u.password),
              email: u.email ? String(u.email) : null,
              role: u.role === 'admin' ? 'ADMIN' : 'USER',
              createdAt: date(u.created_at),
            },
          });
          userIds.set(u.id, user.id);
        }
        for (const f of folders)
          await tx.folder.upsert({
            where: { id: String(f.id) },
            update: {},
            create: { id: String(f.id), name: String(f.name), createdAt: date(f.created_at) },
          });
        for (const t of prepared) {
          const r = t.row;
          await tx.template.upsert({
            where: { id: String(r.id) },
            update: {},
            create: {
              id: String(r.id),
              name: String(r.name),
              color: String(r.color ?? '#087e70'),
              active: !!r.active,
              folderId: folders.some((f) => f.id === r.folder_id) ? String(r.folder_id) : null,
              filePath: files.get(String(r.id)) ?? '',
              fields: t.fields as unknown as Prisma.InputJsonValue,
              pageSizes: t.sizes as unknown as Prisma.InputJsonValue,
              createdAt: date(r.created_at),
            },
          });
        }
        for (const d of documents)
          await tx.document.upsert({
            where: { id: `legacy-doc-${d.id}` },
            update: {},
            create: {
              id: `legacy-doc-${d.id}`,
              templateId: String(d.template_id),
              userId: userIds.get(d.user_id) ?? null,
              username: String(d.username ?? ''),
              values: d.values as Prisma.InputJsonValue,
              createdAt: date(d.created_at),
              downloadedAt: d.downloaded_at ? date(d.downloaded_at) : null,
              emailedAt: d.emailed_at ? date(d.emailed_at) : null,
              emailedTo: d.emailed_to ? String(d.emailed_to) : null,
            },
          });
        try {
          const s = JSON.parse(await readFile(path.join(root, 'db', 'settings.json'), 'utf8'));
          if (s.smtp_pass) s.smtp_pass = encrypt(String(s.smtp_pass));
          await tx.setting.upsert({
            where: { id: 'smtp' },
            update: {},
            create: { id: 'smtp', value: s },
          });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
        await tx.importRun.create({ data: { id, summary } });
      },
      { timeout: 30000 },
    );
    console.log('Import validé. Données PHP inchangées ; mots de passe bcrypt conservés.');
  } catch (e) {
    await Promise.all(created.map(removePdf));
    throw e;
  }
}
main()
  .catch((e) => {
    console.error('Import interrompu :', e instanceof Error ? e.message : 'erreur inconnue');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
