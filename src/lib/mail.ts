import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from './db';
import { decrypt, encrypt, HttpError } from './security';
export const smtpSchema = z.object({
  from_email: z.union([z.email(), z.literal('')]).default(''),
  from_name: z.string().max(120).default('GED By DZ'),
  smtp_host: z.string().max(255).default(''),
  smtp_port: z.number().int().min(1).max(65535).default(587),
  smtp_secure: z.enum(['tls', 'ssl', 'none']).default('tls'),
  smtp_user: z.string().max(255).default(''),
  smtp_pass: z.string().max(2000).optional(),
  smtp_timeout: z.number().int().min(3).max(120).default(20),
});
export type SmtpSettings = z.infer<typeof smtpSchema>;
export async function smtpSettings() {
  const row = await db.setting.findUnique({ where: { id: 'smtp' } });
  return (row?.value ?? smtpSchema.parse({})) as SmtpSettings;
}
export async function saveSmtp(raw: unknown) {
  const value = smtpSchema.parse(raw),
    old = await smtpSettings();
  value.smtp_pass = value.smtp_pass ? encrypt(value.smtp_pass) : (old.smtp_pass ?? '');
  await db.setting.upsert({
    where: { id: 'smtp' },
    create: { id: 'smtp', value },
    update: { value },
  });
}
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  attachments: { filename: string; content: Buffer }[] = [],
) {
  z.email().parse(to);
  const s = await smtpSettings();
  if (!s.smtp_host || !s.from_email)
    throw new HttpError(400, 'Configurez le serveur SMTP et l’expéditeur.');
  const transport = nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_secure === 'ssl',
    requireTLS: s.smtp_secure === 'tls',
    ignoreTLS: s.smtp_secure === 'none',
    auth: s.smtp_user ? { user: s.smtp_user, pass: decrypt(s.smtp_pass ?? '') } : undefined,
    connectionTimeout: s.smtp_timeout * 1000,
  });
  try {
    await transport.sendMail({
      from: { name: s.from_name, address: s.from_email },
      to,
      subject,
      text,
      attachments,
    });
  } finally {
    transport.close();
  }
}
