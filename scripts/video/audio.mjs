// Offline sound design: sound effects from the cue list, stereo 48 kHz.
const SR = 48000;
let seed = 20261028;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mkbuf = (sec) => new Float32Array(Math.max(1, Math.floor(sec * SR)));
const norm = (b) => {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] /= m;
  return b;
};

function bandNoise(sec, fc, q = 0.3) {
  const b = mkbuf(sec);
  let low = 0,
    band = 0;
  for (let i = 0; i < b.length; i++) {
    const f = 2 * Math.sin((Math.PI * fc(i / b.length)) / SR);
    low += f * band;
    const high = rnd() - low - q * band;
    band += f * high;
    b[i] = band;
  }
  return norm(b);
}
function tone(sec, freq, decay, shape = (p) => Math.sin(p)) {
  const b = mkbuf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (typeof freq === 'function' ? freq(t) : freq)) / SR;
    b[i] = shape(ph) * Math.exp(-t * decay) * Math.min(1, t * 800);
  }
  return b;
}
const mix = (...parts) => {
  const len = Math.max(...parts.map(([b, at = 0]) => b.length + Math.floor(at * SR)));
  const o = new Float32Array(len);
  for (const [b, at = 0, g = 1] of parts) {
    const o0 = Math.floor(at * SR);
    for (let i = 0; i < b.length; i++) o[o0 + i] += b[i] * g;
  }
  return o;
};

const G = {
  tick: () => {
    const n = bandNoise(0.03, () => 3500 + rnd() * 600, 0.8);
    for (let i = 0; i < n.length; i++) n[i] *= Math.exp(-(i / SR) * 260);
    return norm(mix([n, 0, 0.7], [tone(0.04, 2100 + rnd() * 250, 160), 0, 0.5]));
  },
  click: () =>
    norm(
      mix(
        [tone(0.05, 1500, 120), 0, 0.7],
        [tone(0.07, 190, 70), 0, 0.8],
        [bandNoise(0.01, () => 4500, 0.9), 0, 0.5],
      ),
    ),
  snap: () =>
    norm(
      mix(
        [tone(0.09, 2600, 60), 0, 0.6],
        [bandNoise(0.02, () => 5200, 0.9), 0, 0.8],
        [tone(0.12, 320, 40), 0, 0.5],
      ),
    ),
  pop: () =>
    norm(
      mix(
        [tone(0.22, (t) => 420 + 520 * (1 - Math.exp(-t * 40)), 22), 0, 1],
        [tone(0.12, (t) => 840 + 1040 * (1 - Math.exp(-t * 40)), 40), 0, 0.3],
      ),
    ),
  lock: () =>
    norm(
      mix(
        [tone(0.07, 760, 90), 0, 0.7],
        [tone(0.18, 210, 30), 0.045, 1],
        [bandNoise(0.01, () => 3000, 0.9), 0.045, 0.4],
      ),
    ),
  thump: () => {
    const n = bandNoise(0.2, () => 180, 0.6);
    for (let i = 0; i < n.length; i++) n[i] *= Math.exp(-(i / SR) * 22);
    return norm(mix([tone(0.5, (t) => 42 + 70 * Math.exp(-t * 25), 7), 0, 1], [n, 0, 0.35]));
  },
  boom: () => {
    const n = bandNoise(0.9, (p) => 600 - 450 * p, 0.4);
    for (let i = 0; i < n.length; i++) n[i] *= Math.exp(-(i / SR) * 4.5);
    return norm(
      mix(
        [tone(1.6, (t) => 38 + 60 * Math.exp(-t * 14), 2.6), 0, 1],
        [n, 0, 0.35],
        [tone(1.2, 110, 2.5), 0, 0.15],
      ),
    );
  },
  riser: () => {
    const n = bandNoise(1.1, (p) => 400 * 10 ** (1.3 * p), 0.25);
    for (let i = 0; i < n.length; i++) n[i] *= (i / n.length) ** 2.2;
    const s = tone(1.1, (t) => 220 * 2 ** (3 * (t / 1.1)), 0, Math.sin);
    for (let i = 0; i < s.length; i++) s[i] *= (i / s.length) ** 2;
    return norm(mix([n, 0, 0.6], [s, 0, 0.25]));
  },
  whoosh: () => {
    const b = bandNoise(0.85, (p) => 280 * 15 ** p, 0.22);
    for (let i = 0; i < b.length; i++) b[i] *= Math.sin((Math.PI * i) / b.length) ** 1.6;
    return b;
  },
  swipe: () => {
    const b = bandNoise(0.35, (p) => 500 * 9 ** p, 0.25);
    for (let i = 0; i < b.length; i++) b[i] *= Math.sin((Math.PI * i) / b.length) ** 1.4;
    return b;
  },
  send: () => {
    const b = bandNoise(0.7, (p) => 5200 * 0.12 ** p, 0.2);
    for (let i = 0; i < b.length; i++)
      b[i] *=
        Math.sin((Math.PI * Math.min(1, (i / b.length) * 1.3)) / 1) ** 1.2 *
        Math.exp(-(i / SR) * 1.5);
    return b;
  },
  chime: () => {
    const bell = (f, at, g) => [
      mix(
        [tone(1.8, f, 3.2), 0, 1],
        [tone(1.4, f * 2.01, 5), 0, 0.4],
        [tone(1, f * 3.02, 8), 0, 0.18],
      ),
      at,
      g,
    ];
    return norm(mix(bell(880, 0, 0.8), bell(1318.5, 0.1, 0.7), bell(1760, 0.2, 0.45)));
  },
  shimmer: () => {
    const notes = [1318.5, 1568, 1760, 2093, 2637, 3136];
    return norm(
      mix(
        ...notes.map((f, i) => [
          mix([tone(0.9, f, 5.5), 0, 1], [tone(0.5, f * 2, 9), 0, 0.3]),
          i * 0.055,
          0.7 - i * 0.07,
        ]),
      ),
    );
  },
};

function reverb(inp, mixAmt) {
  const out = new Float32Array(inp.length);
  const comb = (d, g) => {
    const dl = Math.floor(d * SR),
      buf = new Float32Array(dl);
    let idx = 0,
      lp = 0;
    for (let i = 0; i < inp.length; i++) {
      const y = buf[idx];
      lp += (y - lp) * 0.35;
      buf[idx] = inp[i] + lp * g;
      idx = (idx + 1) % dl;
      out[i] += y * 0.25;
    }
  };
  [
    [0.0297, 0.8],
    [0.0371, 0.79],
    [0.0411, 0.78],
    [0.0437, 0.77],
  ].forEach(([d, g]) => comb(d, g));
  for (let i = 0; i < out.length; i++) out[i] *= mixAmt;
  return out;
}

export function synth(cues, dur) {
  const N = Math.floor(dur * SR);
  const L = new Float32Array(N),
    R = new Float32Array(N);
  const sendL = new Float32Array(N),
    sendR = new Float32Array(N);
  const cache = {};
  for (const c of cues) {
    const gen = G[c.type];
    if (!gen || c.vol <= 0 || c.t >= dur) continue;
    const buf = c.type === 'tick' ? gen() : (cache[c.type] ||= gen());
    const o0 = Math.floor(Math.max(0, c.t) * SR),
      skip = c.t < 0 ? Math.floor(-c.t * SR) : 0;
    const gl = Math.cos(((c.pan + 1) * Math.PI) / 4),
      gr = Math.sin(((c.pan + 1) * Math.PI) / 4);
    const level =
      {
        tick: 0.2,
        click: 0.35,
        snap: 0.35,
        pop: 0.3,
        lock: 0.35,
        thump: 0.6,
        boom: 0.85,
        riser: 0.4,
        whoosh: 0.3,
        swipe: 0.25,
        send: 0.28,
        chime: 0.3,
        shimmer: 0.2,
      }[c.type] ?? 0.3;
    const wet = ['chime', 'shimmer', 'boom', 'pop', 'riser'].includes(c.type) ? 0.45 : 0.12;
    for (let i = skip; i < buf.length; i++) {
      const k = o0 + i - skip;
      if (k >= N) break;
      const v = buf[i] * c.vol * level;
      L[k] += v * gl;
      R[k] += v * gr;
      sendL[k] += v * gl * wet;
      sendR[k] += v * gr * wet;
    }
  }
  const rl = reverb(sendL, 1.1),
    rr = reverb(sendR, 1.1);
  for (let i = 0; i < N; i++) {
    const t = i / SR,
      env = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (dur - t) / 1.2));
    L[i] = Math.tanh((L[i] + rl[i]) * env * 1.1);
    R[i] = Math.tanh((R[i] + rr[i]) * env * 1.1);
  }
  let pk = 0;
  for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / pk;
  for (let i = 0; i < N; i++) {
    L[i] *= g;
    R[i] *= g;
  }
  return { L, R };
}

export function toWav({ L, R }) {
  const n = L.length,
    buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return buf;
}
