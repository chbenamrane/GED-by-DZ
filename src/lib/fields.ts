import { z } from 'zod';
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(['text', 'textarea', 'number', 'date', 'rating', 'select', 'checkbox']),
  page: z.number().int().min(0).default(0),
  x: z.number().finite().min(0),
  y: z.number().finite().min(0),
  size: z.number().min(4).max(48).default(10),
  bold: z.boolean().default(false),
  required: z.boolean().default(false),
  max_chars: z.number().int().min(0).max(5000).default(0),
  max_width_mm: z.number().min(0).max(14400).default(0),
  default: z.string().max(5000).default(''),
  clear_before: z.boolean().default(false),
  options: z
    .array(
      z.union([
        z.string().max(120),
        z.object({
          label: z.string().max(120),
          x: z.number().finite().min(0),
          y: z.number().finite().min(0),
        }),
      ]),
    )
    .max(100)
    .default([]),
  _duplicate: z.boolean().optional(),
  _dup_id: z.string().max(80).optional(),
});
export type Field = z.infer<typeof fieldSchema>;
export type PageSize = { width: number; height: number; rotation: number };
export type Values = Record<string, string | number[]>;
export function validateFields(raw: unknown, sizes: PageSize[]) {
  const fields = z.array(fieldSchema).max(300).parse(raw);
  for (const f of fields) {
    const p = sizes[f.page];
    if (!p || f.x > p.width || f.y > p.height || f.max_width_mm > p.width)
      throw new Error('Champ hors des dimensions de la page.');
    for (const o of f.options)
      if (typeof o !== 'string' && (o.x > p.width || o.y > p.height))
        throw new Error('Case hors de la page.');
  }
  return fields;
}
export function validateValues(fields: Field[], raw: Record<string, unknown>): Values {
  const values: Values = {};
  for (const f of fields) {
    if (f.type === 'checkbox') {
      const selected = Array.isArray(raw[f.key]) ? (raw[f.key] as unknown[]) : [];
      values[f.key] = [
        ...new Set(
          selected.filter(
            (n): n is number =>
              Number.isInteger(n) && Number(n) >= 0 && Number(n) < f.options.length,
          ),
        ),
      ];
      if (f.required && !(values[f.key] as number[]).length)
        throw new Error(`${f.label} est obligatoire.`);
      continue;
    }
    let value = String(raw[f.key] ?? f.default ?? '')
      .trim()
      .slice(0, 5000);
    if (f.type === 'date' && (!value || value === 'auto'))
      value = new Intl.DateTimeFormat('fr-FR').format(new Date());
    if (f.required && !value) throw new Error(`${f.label} est obligatoire.`);
    if (f.type === 'rating' && value) value = String(Math.min(5, Math.max(1, Number(value) || 1)));
    if (
      f.type === 'number' &&
      value &&
      !Number.isFinite(Number(value.replace(/\s/g, '').replace(',', '.')))
    )
      throw new Error(`${f.label} doit être un nombre.`);
    if (f.type === 'select' && value && !f.options.includes(value))
      throw new Error(`${f.label} : option invalide.`);
    values[f.key] = f.max_chars ? value.slice(0, f.max_chars) : value;
  }
  return values;
}
