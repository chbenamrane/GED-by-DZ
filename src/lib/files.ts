import path from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export const storageRoot = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? './storage');
export function safePath(name: string) {
  if (!/^[a-zA-Z0-9_-]+\.pdf$/.test(name)) throw new Error('Chemin de fichier invalide.');
  return path.join(storageRoot(), 'templates', name);
}
export async function storePdf(bytes: Uint8Array) {
  const name = `${randomUUID()}.pdf`;
  await mkdir(path.dirname(safePath(name)), { recursive: true });
  await writeFile(safePath(name), bytes, { flag: 'wx' });
  return name;
}
export const readPdf = (name: string) => readFile(safePath(name));
export async function removePdf(name: string) {
  await unlink(safePath(name)).catch(() => {});
}
