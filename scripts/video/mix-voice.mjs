// Mixes a continuous voice-over recording into the rendered video.
//   node scripts/video/mix-voice.mjs fr|en <voice-file>
// The recording is cut at the pauses between sentences into the 7 scene segments,
// each segment is placed on its scene, and the sound effects duck under the voice.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const lang = process.argv[2] === 'en' ? 'en' : 'fr';
const voice = process.argv[3];
if (!voice) throw new Error('Usage: mix-voice.mjs fr|en <voice-file>');

// Second at which speech starts for each of the 7 segments, measured in the recording.
const speechStart = {
  fr: [0, 7.72, 12.36, 17.08, 22.16, 28.31, 35.0],
  en: [0, 7.72, 12.82, 18.7, 24.3, 31.13, 37.78],
}[lang];
const LEAD = 0.15; // keep a little room before the first word
const target = [0.5, 8.5, 16.5, 24.5, 32.5, 40.5, 48.3]; // where each segment's speech starts

const chains = speechStart.map((s, k) => {
  const start = Math.max(0, s - LEAD);
  const end = k < 6 ? speechStart[k + 1] - LEAD : null;
  const delay = Math.round((target[k] - (s - start)) * 1000);
  const trim = `atrim=start=${start.toFixed(3)}${end ? `:end=${end.toFixed(3)}` : ''}`;
  return `[1:a]${trim},asetpts=PTS-STARTPTS,adelay=${delay}[s${k}]`;
});
const filter = [
  ...chains,
  `${speechStart.map((_, k) => `[s${k}]`).join('')}amix=inputs=7:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,pan=stereo|c0=c0|c1=c0,asplit[v][sc]`,
  '[0:a]volume=0.6[sfx]',
  '[sfx][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=300[duck]',
  '[duck][v]amix=inputs=2:duration=first:normalize=0[a]',
].join(';');

const dir = fileURLToPath(new URL('../../storage/presentation/', import.meta.url));
const out = `${dir}ged-by-dz-${lang}-final.mp4`;
const r = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${dir}ged-by-dz-${lang}.mp4`,
    '-i',
    voice,
    '-filter_complex',
    filter,
    '-map',
    '0:v:0',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-t',
    '56',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('wrote', out);
