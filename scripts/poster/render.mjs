// Renders the advertising poster (FR and EN) as Full HD PNG files.
//   node scripts/poster/render.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = new URL('../../storage/marketing/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  for (const lang of ['fr', 'en']) {
    await page.goto(
      `${pathToFileURL(fileURLToPath(new URL('./poster.html', import.meta.url)))}?lang=${lang}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const path = fileURLToPath(new URL(`affiche-${lang}.png`, out));
    await page.screenshot({ path });
    console.log('wrote', path);
  }
} finally {
  await browser.close();
}
