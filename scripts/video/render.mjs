// Renders the project presentation: HTML/CSS motion graphics captured frame by frame,
// synthesized sound effects, encoded to MP4 with FFmpeg.
//   node scripts/video/render.mjs fr|en            full render
//   node scripts/video/render.mjs fr --stills 1,9  PNG stills at those seconds
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { synth, toWav } from './audio.mjs';

const FPS = 30;
const DURATION = 56;
const lang = process.argv[2] === 'en' ? 'en' : 'fr';
const stillsArg = process.argv.indexOf('--stills');
const outArg = process.argv.indexOf('--out');
const out = new URL('../../storage/presentation/', import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  // Layout is authored at 1920x1080; the 4/3 scale factor captures it at 2560x1440 (1440p).
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 4 / 3,
  });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.goto(
    `${pathToFileURL(fileURLToPath(new URL('./scene.html', import.meta.url)))}?lang=${lang}`,
  );
  await page.evaluate(() => document.fonts.ready);
  const cues = await page.evaluate(() => window.CUES);

  if (stillsArg > 0) {
    const dir = process.argv[outArg + 1];
    await mkdir(dir, { recursive: true });
    for (const s of process.argv[stillsArg + 1].split(',')) {
      await page.evaluate((t) => window.renderAt(t), Number(s));
      await page.screenshot({ path: `${dir}/${lang}-${String(s).padStart(5, '0')}.png` });
    }
    console.log('stills done');
  } else {
    const wav = toWav(synth(cues, DURATION));
    const wavPath = fileURLToPath(new URL(`sfx-${lang}.wav`, out));
    await writeFile(wavPath, wav);
    const mp4 = fileURLToPath(new URL(`ged-by-dz-${lang}.mp4`, out));
    const ff = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(FPS),
        '-f',
        'image2pipe',
        '-c:v',
        'mjpeg',
        '-i',
        '-',
        '-i',
        wavPath,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-b:v',
        '20M',
        '-maxrate',
        '28M',
        '-bufsize',
        '40M',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-t',
        String(DURATION),
        '-movflags',
        '+faststart',
        mp4,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const total = FPS * DURATION;
    for (let i = 0; i < total; i++) {
      await page.evaluate((t) => window.renderAt(t), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
      if (i % 150 === 0) console.log(lang, `${i}/${total}`);
    }
    ff.stdin.end();
    const [code] = await once(ff, 'close');
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
    console.log('wrote', mp4);
  }
} finally {
  await browser.close();
}
