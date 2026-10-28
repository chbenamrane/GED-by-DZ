import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../storage/presentation/', import.meta.url);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const lang of ['fr', 'en']) {
    if (process.argv[2] && process.argv[2] !== lang) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(
      '<style>body{margin:0}video{width:1280px;height:720px}</style><video muted></video>',
    );
    const bytes = await readFile(new URL(`ged-by-dz-${lang}.webm`, root));
    const report = await page.evaluate(async (data) => {
      const video = document.querySelector('video');
      const loaded = new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Video decode failed'));
      });
      video.src = URL.createObjectURL(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: 'video/webm' }),
      );
      await loaded;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = 1e9;
      });
      const duration = video.duration;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = 19;
      });
      if (video.videoWidth !== 1280 || video.videoHeight !== 720 || duration > 57 || duration < 55)
        throw new Error(`Unexpected format or duration: ${duration}`);
      if (!video.webkitAudioDecodedByteCount && !video.audioTracks?.length) {
        // Play briefly so Chromium decodes and confirms the audio track.
        await video.play();
        await new Promise((r) => setTimeout(r, 250));
        video.pause();
      }
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration,
        audioDecodedBytes: video.webkitAudioDecodedByteCount,
      };
    }, bytes.toString('base64'));
    if (!report.audioDecodedBytes) throw new Error('No decoded audio');
    await page.screenshot({
      path: new URL(`preview-${lang}.png`, root).pathname.replace(/^\/(\w:)/, '$1'),
    });
    await writeFile(new URL(`check-${lang}.json`, root), JSON.stringify(report, null, 2));
    console.log(lang, report);
    await page.close();
  }
} finally {
  await browser.close();
}
