import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from './db';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = (u: {
  id: string;
  username: string;
  role: string;
  email: string | null;
}) => ({ id: u.id, username: u.username, role: u.role, email: u.email });
const COOKIE = 'ged_dz_session';
export function checkOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected)
    throw new HttpError(403, 'Origine de la requête refusée.');
}
export async function rateLimit(id: string, max: number, seconds: number) {
  const key = hashToken(id);
  const now = new Date();
  await db.rateLimit.upsert({
    where: { id: key },
    create: { id: key, count: 0, expiresAt: new Date(Date.now() + seconds * 1000) },
    update: {},
  });
  await db.rateLimit.updateMany({
    where: { id: key, expiresAt: { lt: now } },
    data: { count: 0, expiresAt: new Date(Date.now() + seconds * 1000) },
  });
  const row = await db.rateLimit.update({ where: { id: key }, data: { count: { increment: 1 } } });
  if (row.count > max)
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
}
export function passwordPolicy(password: string) {
  if (
    password.length < 8 ||
    password.length > 200 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  )
    throw new HttpError(400, 'Mot de passe : 8 caractères minimum, avec une lettre et un chiffre.');
}
export const passwordHash = (password: string) => bcrypt.hash(password, 12);
export const checkPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$'));
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + 24 * 3600_000) },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(process.env.APP_URL ?? 'http://localhost:3000').protocol === 'https:',
    path: '/',
    maxAge: 24 * 3600,
  });
}
export async function sessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (
    !s ||
    s.expiresAt.getTime() < Date.now() ||
    s.lastSeenAt.getTime() < Date.now() - 4 * 3600_000
  )
    return null;
  if (s.lastSeenAt.getTime() < Date.now() - 60_000)
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  return publicUser(s.user);
}
export async function requireUser(admin = false) {
  const u = await sessionUser();
  if (!u) throw new HttpError(401, 'Connexion requise.');
  if (admin && u.role !== 'ADMIN') throw new HttpError(403, 'Accès administrateur requis.');
  return u;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}
function encryptionKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new HttpError(500, 'Clé de chiffrement SMTP manquante.');
  return Buffer.from(hex, 'hex');
}
export function encrypt(value: string) {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((x) => x.toString('hex')).join(':');
}
export function decrypt(value: string) {
  if (!value) return '';
  const [iv, tag, data] = value.split(':').map((x) => Buffer.from(x, 'hex'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
