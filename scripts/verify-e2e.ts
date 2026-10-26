import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, request as playwrightRequest } from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';
import { db } from '../src/lib/db';
import { passwordHash, hashToken } from '../src/lib/security';
import { removePdf } from '../src/lib/files';
import { inspectPdf } from '../src/lib/pdf';
import { fieldSchema } from '../src/lib/fields';
import { createServer } from 'node:net';

const url = process.env.APP_URL ?? 'http://localhost:3000';
const prefix = `e2e_${Date.now()}`;
const password = `Test9!${randomBytes(12).toString('hex')}`;
const contexts: Awaited<ReturnType<typeof playwrightRequest.newContext>>[] = [];
const templateIds: string[] = [];
const documentIds: string[] = [];
const files: string[] = [];
const usernames: string[] = [];
const report: string[] = [];
const pass = (message: string) => {
  report.push(message);
  console.log('OK:', message);
};
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let smtp: ReturnType<typeof createServer> | undefined;
let previousSetting: Awaited<ReturnType<typeof db.setting.findUnique>> | undefined;
async function main() {
  const hash = await passwordHash(password);
  for (const [suffix, role] of [
    ['admin', 'ADMIN'],
    ['alice', 'USER'],
    ['bob', 'USER'],
  ] as const) {
    const username = `${prefix}_${suffix}`;
    usernames.push(username);
    await db.user.create({ data: { username, passwordHash: hash, role } });
  }
  const context = async (user: string) => {
    const c = await playwrightRequest.newContext({
      baseURL: url,
      extraHTTPHeaders: { Origin: url },
    });
    contexts.push(c);
    const r = await c.post('/api/auth/login', { data: { username: user, password } });
    assert.equal(r.status(), 200, await r.text());
    return c;
  };
  const noAuth = await playwrightRequest.newContext({ baseURL: url });
  contexts.push(noAuth);
  assert.equal((await noAuth.get('/api/bootstrap')).status(), 401);
  assert.equal(
    (await noAuth.post('/api/auth/login', { data: { username: usernames[0], password } })).status(),
    403,
  );
  pass('Accès anonyme et requête sans origine refusés');
  const admin = await context(usernames[0]),
    alice = await context(usernames[1]),
    bob = await context(usernames[2]);
  assert.equal((await alice.get('/api/users')).status(), 403);
  assert.equal((await alice.get('/api/settings')).status(), 403);
  pass('Administration protégée côté serveur');
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  pdf.addPage([842, 595]);
  const rotated = pdf.addPage([400, 700]);
  rotated.setRotation(degrees(90));
  rotated.setCropBox(10, 20, 350, 650);
  const source = await pdf.save();
  const upload = await admin.post('/api/templates', {
    multipart: {
      name: `${prefix} Modèle`,
      color: '#087e70',
      file: { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(source) },
    },
  });
  assert.equal(upload.status(), 201, await upload.text());
  const template = (await upload.json()).data;
  templateIds.push(template.id);
  files.push(template.filePath);
  const fields = [
    fieldSchema.parse({
      key: 'nom',
      label: 'Nom du test',
      type: 'text',
      page: 0,
      x: 30,
      y: 45,
      required: true,
      max_width_mm: 80,
    }),
    fieldSchema.parse({
      key: 'accord',
      label: 'Accord',
      type: 'checkbox',
      page: 1,
      x: 30,
      y: 40,
      options: [{ label: 'Oui', x: 30, y: 40 }],
    }),
    fieldSchema.parse({
      key: 'note',
      label: 'Note du test',
      type: 'textarea',
      page: 2,
      x: 20,
      y: 40,
      max_width_mm: 90,
    }),
  ];
  assert.equal(
    (
      await admin.patch(`/api/templates/${template.id}`, { data: { fields, active: true } })
    ).status(),
    200,
  );
  pass('Import, formats mixtes et champs sur plusieurs pages');
  const preview = await admin.post(`/api/templates/${template.id}/preview`, { data: { fields } });
  assert.equal(preview.status(), 200);
  assert.deepEqual(await inspectPdf(await preview.body()), await inspectPdf(source));
  pass('PDF test conserve pages, dimensions et rotations');
  const created = await alice.post('/api/documents', {
    data: {
      templateId: template.id,
      rows: [
        { nom: 'Amina École', accord: [0], note: 'Texte sur la page tournée.' },
        { nom: 'Deuxième document', accord: [], note: 'Deuxième.' },
      ],
    },
  });
  assert.equal(created.status(), 201, await created.text());
  const docs = (await created.json()).data as { id: string }[];
  documentIds.push(...docs.map((d) => d.id));
  const pdfResponse = await alice.get(`/api/documents/${docs[0].id}/pdf`);
  assert.equal(pdfResponse.status(), 200);
  assert.deepEqual(await inspectPdf(await pdfResponse.body()), await inspectPdf(source));
  const zip = await alice.post('/api/documents/export', { data: { ids: docs.map((d) => d.id) } });
  assert.equal(zip.status(), 200);
  assert.equal(zip.headers()['content-type'], 'application/zip');
  assert.equal((await bob.get(`/api/documents/${docs[0].id}`)).status(), 404);
  assert.equal((await bob.get(`/api/documents/${docs[0].id}/pdf`)).status(), 404);
  assert.equal((await bob.delete(`/api/documents/${docs[0].id}`)).status(), 404);
  assert.equal(
    (await bob.post('/api/documents/export', { data: { ids: [docs[0].id] } })).status(),
    403,
  );
  pass('Génération multiple, PDF, ZIP et isolation entre utilisateurs');
  assert.equal(
    (
      await alice.post('/api/documents', { data: { templateId: template.id, rows: [{}] } })
    ).status(),
    400,
  );
  pass('Validation des champs obligatoires');
  const folderResponse = await admin.post('/api/folders', { data: { name: `${prefix} Dossier` } });
  assert.equal(folderResponse.status(), 201);
  const folderId = (await folderResponse.json()).data.id;
  await admin.patch(`/api/templates/${template.id}`, { data: { folderId } });
  assert.equal(
    (
      await admin.patch(`/api/folders/${folderId}`, { data: { name: `${prefix} Renommé` } })
    ).status(),
    200,
  );
  assert.equal((await admin.delete(`/api/folders/${folderId}`)).status(), 200);
  assert.equal(
    (await (await admin.get(`/api/templates/${template.id}`)).json()).data.folderId,
    null,
  );
  pass('Dossiers : création, rangement, renommage et suppression sans perte des modèles');
  const messages: string[] = [];
  smtp = createServer((socket) => {
    socket.write('220 localhost GED test\r\n');
    let buffer = '',
      data = false,
      message = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') {
            messages.push(message);
            message = '';
            data = false;
            socket.write('250 Message received\r\n');
          } else message += line + '\r\n';
        } else if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 SIZE 50000000\r\n');
        else if (/^DATA/.test(line)) {
          data = true;
          socket.write('354 End with dot\r\n');
        } else if (/^QUIT/.test(line)) {
          socket.end('221 Bye\r\n');
        } else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => smtp!.listen(0, '127.0.0.1', resolve));
  const address = smtp.address();
  assert.ok(address && typeof address !== 'string');
  previousSetting = await db.setting.findUnique({ where: { id: 'smtp' } });
  assert.equal(
    (
      await admin.patch('/api/settings', {
        data: {
          from_email: 'test@example.invalid',
          from_name: 'GED By DZ Test',
          smtp_host: '127.0.0.1',
          smtp_port: address.port,
          smtp_secure: 'none',
          smtp_user: '',
          smtp_pass: '',
        },
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await admin.post('/api/settings/test', { data: { email: 'recipient@example.invalid' } })
    ).status(),
    200,
  );
  assert.equal(
    (
      await alice.post('/api/documents/export', {
        data: { ids: [docs[0].id], email: 'recipient@example.invalid' },
      })
    ).status(),
    200,
  );
  assert.equal(messages.length, 2);
  assert.ok(messages[1].includes('application/pdf'));
  assert.ok((await db.document.findUniqueOrThrow({ where: { id: docs[0].id } })).emailedAt);
  pass('SMTP local : e-mail de test, PDF en pièce jointe et statut envoyé');
  if (previousSetting)
    await db.setting.upsert({
      where: { id: 'smtp' },
      create: { id: 'smtp', value: previousSetting.value as never },
      update: { value: previousSetting.value as never },
    });
  else await db.setting.deleteMany({ where: { id: 'smtp' } });
  previousSetting = undefined;
  await new Promise<void>((resolve) => smtp!.close(() => resolve()));
  smtp = undefined;
  const bad = await admin.post('/api/templates', {
    multipart: {
      name: 'Invalid',
      file: {
        name: 'fake.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7 invalid'),
      },
    },
  });
  assert.equal(bad.status(), 400);
  pass('Faux PDF refusé avant enregistrement');
  await mkdir('storage/qa', { recursive: true });
  browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const browserContext = await browser.newContext({
    storageState: await admin.storageState(),
    viewport: { width: 1600, height: 1000 },
  });
  const page = await browserContext.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/templates/${template.id}`);
  await page.locator('canvas[data-rendered-page="1"]').waitFor();
  await page.screenshot({ path: 'storage/qa/editor.png', fullPage: true });
  const alerts = await page.locator('.error[role=alert]').allTextContents();
  assert.deepEqual(alerts, []);
  await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
  await page.locator('canvas[data-rendered-page="2"]').waitFor();
  await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
  await page.locator('canvas[data-rendered-page="3"]').waitFor();
  assert.equal(await page.locator('.error[role=alert]').count(), 0);
  await page.screenshot({ path: 'storage/qa/editor-rotated.png', fullPage: true });
  pass('Rendu navigateur PDF.js effectif sur page standard et tournée');
  await page.getByRole('button', { name: /1\. Nom du test/ }).click();
  await page.locator('canvas[data-rendered-page="1"]').waitFor();
  const marker = await page.locator('[title="Nom du test"]').boundingBox();
  assert.ok(marker);
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker.x + marker.width / 2 + 30, marker.y + marker.height / 2 + 20, {
    steps: 5,
  });
  await page.mouse.up();
  await page.getByLabel('Libellé', { exact: true }).fill('Nom du test modifié');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByText('Modèle prêt à éditer').waitFor();
  const saved = (await (await admin.get(`/api/templates/${template.id}`)).json()).data.fields[0];
  assert.equal(saved.label, 'Nom du test modifié');
  assert.ok(saved.x > 30 && saved.y > 45);
  pass('Déplacement visuel du champ et sauvegarde via navigateur');
  const aliceBrowser = await browser.newContext({
    storageState: await alice.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const form = await aliceBrowser.newPage();
  form.on('pageerror', (e) => errors.push(e.message));
  await form.goto(`${url}/generate/${template.id}`);
  await form.getByLabel('Nom du test modifié').fill('Document navigateur');
  await form.getByLabel('Oui', { exact: true }).check();
  await form.getByLabel('Note du test').fill('Saisie du formulaire.');
  await form.getByLabel('Action après génération').selectOption('save');
  await form.getByRole('button', { name: 'Générer le document', exact: true }).click();
  await form.getByText('Document(s) enregistré(s).', { exact: true }).waitFor();
  const uiDocs = await db.document.findMany({ where: { templateId: template.id } });
  documentIds.push(...uiDocs.map((d) => d.id));
  assert.equal(uiDocs.length, 3);
  pass('Formulaire navigateur et enregistrement PostgreSQL');
  await page.goto(`${url}/documents`);
  await page.getByRole('heading', { name: 'Vos documents', exact: true }).waitFor();
  await page.screenshot({ path: 'storage/qa/documents.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'storage/qa/mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
  );
  pass('Interface documents et affichage mobile');
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const login = await anon.newPage();
  await login.goto(`${url}/login`);
  await login.screenshot({ path: 'storage/qa/login.png', fullPage: true });
  await login.getByLabel('Identifiant', { exact: true }).fill(usernames[2]);
  await login.getByLabel('Mot de passe', { exact: true }).fill(password);
  await login.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await login.waitForURL('**/documents');
  pass('Connexion navigateur');
  assert.deepEqual(errors, []);
  pass('Aucune erreur JavaScript navigateur');
  const token = randomBytes(32).toString('hex');
  const aliceUser = await db.user.findUniqueOrThrow({ where: { username: usernames[1] } });
  await db.resetToken.create({
    data: { id: hashToken(token), userId: aliceUser.id, expiresAt: new Date(Date.now() + 60000) },
  });
  const reset = await noAuth.post('/api/auth/reset', {
    headers: { Origin: url },
    data: { token, password: password + '1' },
  });
  assert.equal(reset.status(), 200);
  assert.equal((await alice.get('/api/bootstrap')).status(), 401);
  assert.equal(
    (
      await noAuth.post('/api/auth/reset', {
        headers: { Origin: url },
        data: { token, password: password + '2' },
      })
    ).status(),
    400,
  );
  pass('Réinitialisation à usage unique et révocation des sessions');
  await writeFile(
    'storage/qa/report.json',
    JSON.stringify({ at: new Date().toISOString(), passed: report }, null, 2),
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await Promise.all(contexts.map((c) => c.dispose()));
    if (smtp) {
      if (previousSetting)
        await db.setting.upsert({
          where: { id: 'smtp' },
          create: { id: 'smtp', value: previousSetting.value as never },
          update: { value: previousSetting.value as never },
        });
      else await db.setting.deleteMany({ where: { id: 'smtp' } });
      await new Promise<void>((resolve) => smtp!.close(() => resolve()));
    }
    await db.document.deleteMany({ where: { templateId: { in: templateIds } } });
    await db.template.deleteMany({ where: { id: { in: templateIds } } });
    await db.user.deleteMany({ where: { username: { in: usernames } } });
    await Promise.all(files.map(removePdf));
    await db.folder.deleteMany({ where: { name: { startsWith: prefix } } });
    await Promise.all(
      usernames.map((username) =>
        db.rateLimit.deleteMany({ where: { id: hashToken(`login:${username.toLowerCase()}`) } }),
      ),
    );
    await db.$disconnect();
  });
