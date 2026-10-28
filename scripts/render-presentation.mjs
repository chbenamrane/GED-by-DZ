import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Original vector animation and synthesized sound effects. No customer assets.
const out = new URL('../storage/presentation/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
try {
  for (const lang of ['fr', 'en']) {
    if (process.argv[2] && process.argv[2] !== lang) continue;
    console.log('Rendering', lang);
    const page = await browser.newPage();
    page.on('console', (message) => console.log(lang, message.text()));
    await page.bringToFront();
    const chunks = [];
    await page.exposeFunction('saveChunk', (bytes) => chunks.push(Buffer.from(bytes)));
    await page.setContent('<canvas width="1280" height="720"></canvas>');
    const result = await page.evaluate(async (lang) => {
      const copy = {
        fr: [
          ['Vos PDF. Tout simplement.', 'Transformez vos documents en formulaires réutilisables.'],
          ['Importez. Organisez.', 'Des modèles classés par dossier.'],
          ['Placez vos champs.', 'Un éditeur visuel sur toutes les pages.'],
          ['Remplissez. Générez.', 'Un document, ou plusieurs en une fois.'],
          ['Retrouvez. Partagez.', 'Historique, recherche, PDF, ZIP et e-mail.'],
          ['Vos formats, préservés.', 'Pages, dimensions et orientations conservées.'],
          ['GED By DZ', 'Du PDF au formulaire. Du formulaire au document.'],
        ],
        en: [
          ['Your PDFs. Simplified.', 'Turn your documents into reusable forms.'],
          ['Import. Organize.', 'Keep your templates sorted into folders.'],
          ['Place your fields.', 'A visual editor across every page.'],
          ['Fill in. Generate.', 'Create one document, or a whole batch.'],
          ['Find. Share.', 'History, search, PDF, ZIP and email.'],
          ['Your formats, preserved.', 'Original pages, dimensions and orientations.'],
          ['GED By DZ', 'From PDF to form. From form to document.'],
        ],
      }[lang];
      const canvas = document.querySelector('canvas');
      const c = canvas.getContext('2d');
      const audio = new AudioContext({ sampleRate: 48000 });
      await Promise.race([
        audio.resume(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Audio startup timed out')), 10000),
        ),
      ]);
      console.log('Audio ready');
      const dest = audio.createMediaStreamDestination();
      function ping(at, freq, length, volume) {
        const osc = audio.createOscillator(),
          gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, at);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + length);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(at);
        osc.stop(at + length);
      }
      const base = audio.currentTime + 0.15;
      for (let i = 0; i < 7; i++) {
        ping(base + i * 8 + 0.15, 440 + i * 55, 0.35, 0.13);
        for (let j = 0; j < 3; j++) ping(base + i * 8 + 2 + j * 0.18, 880 + j * 220, 0.12, 0.045);
      }
      ping(base + 50, 660, 0.7, 0.09);
      ping(base + 50.2, 990, 1, 0.07);
      function box(x, y, w, h, fill, r = 16) {
        c.fillStyle = fill;
        c.beginPath();
        c.roundRect(x, y, w, h, r);
        c.fill();
      }
      function text(s, x, y, size = 24, color = '#162c3f', weight = 400) {
        c.fillStyle = color;
        c.font = `${weight} ${size}px Arial`;
        c.fillText(s, x, y);
      }
      function paper(x, y, w, h, fields = false) {
        box(x + 8, y + 10, w, h, '#dce6e8');
        box(x, y, w, h, 'white', 10);
        text('PDF', x + 22, y + 38, 18, '#087e70', 700);
        for (let j = 0; j < 5; j++) box(x + 22, y + 62 + j * 31, w - 44, 7, '#e3eaf0', 3);
        if (fields)
          for (let j = 0; j < 3; j++) {
            box(x + 22, y + 85 + j * 49, w - 44, 33, '#d9f4ed', 5);
            text(j === 2 ? '✓' : 'Aa', x + 32, y + 108 + j * 49, 17, '#087e70', 700);
          }
      }
      function draw(t) {
        const scene = Math.min(6, Math.floor(t / 8)),
          local = t - scene * 8;
        c.globalAlpha = 1;
        c.fillStyle = '#f5f7fa';
        c.fillRect(0, 0, 1280, 720);
        const glow = c.createRadialGradient(1050, 180, 0, 1050, 180, 650);
        glow.addColorStop(0, '#d4f2e9');
        glow.addColorStop(1, '#f5f7fa');
        c.fillStyle = glow;
        c.fillRect(0, 0, 1280, 720);
        text('GED', 64, 60, 25, '#087e70', 700);
        text('BY DZ', 124, 60, 16, '#162c3f', 700);
        text(
          lang === 'fr' ? 'PRÉSENTATION DU PROJET' : 'PROJECT OVERVIEW',
          970,
          58,
          13,
          '#657789',
          700,
        );
        const ease = 1 - Math.pow(1 - Math.min(1, local / 0.8), 3);
        c.save();
        c.globalAlpha = Math.min(1, local / 0.4, (56 - t) / 0.8);
        c.translate(0, (1 - ease) * 28);
        text(copy[scene][0], 64, 167, 48, '#162c3f', 700);
        text(copy[scene][1], 66, 212, 24, '#657789');
        const float = Math.sin(local * 1.4) * 5;
        c.save();
        c.translate(0, float);
        if (scene === 0) {
          paper(260, 287, 210, 285);
          text('→', 565, 450, 72, '#087e70');
          paper(790, 287, 210, 285, true);
        } else if (scene === 1) {
          for (let i = 0; i < 3; i++) {
            const x = 165 + i * 330;
            box(x, 322, 280, 222, '#e0eee9');
            box(x, 300, 100, 36, '#b6dfd1', 8);
            paper(x + 62, 345, 150, 190);
            text(['01', '02', '03'][i], x + 20, 570, 20, '#087e70', 700);
          }
        } else if (scene === 2) {
          box(200, 270, 880, 330, '#e7edf2');
          box(216, 286, 210, 298, 'white');
          [
            lang === 'fr' ? 'Texte' : 'Text',
            lang === 'fr' ? 'Date' : 'Date',
            lang === 'fr' ? 'Liste' : 'List',
            lang === 'fr' ? 'Case à cocher' : 'Checkbox',
          ].forEach((s, i) => {
            box(234, 311 + i * 59, 175, 42, '#edf5f2', 8);
            text(s, 249, 339 + i * 59, 18);
          });
          paper(567, 285, 270, 295, true);
          const px = 680 + Math.sin(local) * 45,
            py = 400 + Math.cos(local) * 28;
          c.fillStyle = '#087e70';
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + 9, py + 32);
          c.lineTo(px + 16, py + 21);
          c.lineTo(px + 30, py + 17);
          c.fill();
        } else if (scene === 3) {
          paper(230, 280, 230, 300, true);
          text('→', 555, 455, 72, '#087e70');
          for (let i = 2; i >= 0; i--) paper(790 + i * 22, 290 - i * 14, 205, 280, true);
        } else if (scene === 4) {
          box(165, 280, 950, 320, 'white');
          box(190, 302, 900, 46, '#edf3f7');
          text(
            lang === 'fr' ? 'Rechercher un document…' : 'Search documents…',
            211,
            333,
            20,
            '#657789',
          );
          for (let i = 0; i < 3; i++) {
            box(190, 368 + i * 66, 900, 52, i % 2 ? '#f5f7fa' : '#edf8f4');
            text(`Document 00${i + 1}`, 214, 401 + i * 66, 21);
            text(['PDF', 'ZIP', 'E-MAIL'][i], 942, 401 + i * 66, 18, '#087e70', 700);
          }
        } else if (scene === 5) {
          paper(225, 290, 190, 285);
          paper(480, 350, 330, 210);
          paper(875, 290, 175, 285);
          text('✓', 1090, 460, 48, '#087e70', 700);
        } else {
          box(265, 300, 750, 200, '#087e70', 26);
          text('GED By DZ', 414, 390, 64, '#ffffff', 700);
          text(
            lang === 'fr' ? 'Créez. Réutilisez. Simplifiez.' : 'Create. Reuse. Simplify.',
            425,
            447,
            27,
            '#d5f4e9',
          );
        }
        c.restore();
        c.restore();
        for (let i = 0; i < 7; i++)
          box(64 + i * 166, 658, 148, 4, i < scene ? '#087e70' : '#dce5ea', 2);
        box(64 + scene * 166, 658, 148 * Math.min(1, local / 8), 4, '#087e70', 2);
        text(`${String(scene + 1).padStart(2, '0')} / 07`, 1150, 665, 14, '#657789');
      }
      draw(0);
      const stream = canvas.captureStream(30);
      dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      const mime = 'video/webm;codecs=vp9,opus';
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4500000 });
      const pending = [];
      recorder.ondataavailable = (event) =>
        pending.push(
          event.data.arrayBuffer().then((b) => window.saveChunk(Array.from(new Uint8Array(b)))),
        );
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start(1000);
      console.log('Recording started');
      const start = performance.now();
      await new Promise((resolve) => {
        function frame() {
          const t = (performance.now() - start) / 1000;
          draw(Math.min(t, 55.999));
          if (t < 56) setTimeout(frame, 1000 / 30);
          else resolve();
        }
        frame();
      });
      recorder.stop();
      console.log('Recording stopped');
      await stopped;
      await Promise.all(pending);
      await audio.close();
      return { duration: 56, width: 1280, height: 720, mime };
    }, lang);
    await writeFile(new URL(`ged-by-dz-${lang}.webm`, out), Buffer.concat(chunks));
    console.log(lang, result, Buffer.concat(chunks).length, 'bytes');
    await page.close();
  }
} finally {
  await browser.close();
}
