#!/usr/bin/env node
// Generate the hero's sound effects with the ElevenLabs Sound Effects API.
// Run once, locally:   node scripts/generate-sfx.js [event ...] [--refinish]
// --refinish re-trims and re-levels the files already downloaded (no credits).
//
// Needs ELEVENLABS_API_KEY in a local .env file (git-ignored). The key is only
// ever read here: it never goes in the repo, the site or Vercel.
// Writes sfx/<event>-NN.mp3 (tight starts, consistent loudness) and
// sfx/manifest.json. Then upload with scripts/upload-sfx.sh.
// Needs ffmpeg on the PATH for trimming and loudness.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'sfx');

// ── The set ──────────────────────────────────────────────
// gain and pitch (max ± semitones of random detune) go into the manifest;
// the site reads them, so they can be tuned there without touching code.
const EVENTS = {
  'cube-rattle':   { n: 4, secs: 0.6, gain: 0.55, pitch: 3, text: 'Small wooden toy cubes knocking together once, light and dry, a quick clack, close up, no room' },
  'cube-land':     { n: 4, secs: 0.7, gain: 0.8,  pitch: 2, max: 0.35, text: 'A single small wooden cube landing on a wooden table, soft thud with a tiny bounce, close up, dry' },
  'splat':         { n: 2, secs: 0.8, gain: 0.7,  pitch: 2, text: 'A small wet playful paint splat, a cartoon blob of paint hitting paper, cute not gross, dry' },
  'stray-land':    { n: 2, secs: 0.9, gain: 0.9,  pitch: 2, text: 'A small wooden cube dropping from a little height onto a wooden table, a slightly bigger thud and one small bounce, dry' },
  'lemon-impact':  { n: 2, secs: 0.6, gain: 0.85, pitch: 2, text: 'A small wooden cube knocking into a lemon on a table, a soft dull thump' },
  'lemon-roll':    { n: 2, secs: 2.0, gain: 0.6,  pitch: 1, loop: true, text: 'A lemon rolling steadily across a wooden table, soft continuous rumble, seamless loop' },
  'lemon-settle':  { n: 2, secs: 1.0, gain: 0.6,  pitch: 2, text: 'A lemon rocking gently to a stop on a wooden table, a few soft taps fading out' },
  'cheese-impact': { n: 2, secs: 0.6, gain: 0.85, pitch: 2, text: 'A wooden toy block bumping hard into a big wedge of cheese on a wooden table, a clear dense soft thump, close up, loud and present' },
  'cheese-roll':   { n: 4, secs: 0.5, gain: 0.7,  pitch: 2, max: 0.35, text: 'A wedge of cheese tipping over onto a wooden table, one dense soft lumpy thud, dry' },
  'cheese-settle': { n: 2, secs: 0.8, gain: 0.6,  pitch: 2, text: 'A wedge of cheese settling on a wooden table, a heavy soft wobble and stop' },
  'fish-impact':   { n: 2, secs: 0.6, gain: 0.8,  pitch: 2, text: 'A small wooden cube bumping into a goldfish on a table, a soft wet bump, playful, not gross' },
  'fish-roll':     { n: 4, secs: 0.5, gain: 0.65, pitch: 3, max: 0.3, text: 'A small goldfish flopping once on a wooden table, a tiny wet slap, playful cartoon, not gross' },
  'fish-settle':   { n: 2, secs: 0.9, gain: 0.6,  pitch: 2, text: 'A small goldfish giving a last little wiggle and flop on a table, tiny wet pats, playful, not gross' },
};

function readEnv() {
  const file = path.join(ROOT, '.env');
  const env = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...env, ...process.env };
}

async function generate(key, spec) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: spec.text,
      duration_seconds: spec.secs,
      prompt_influence: 0.6,
      ...(spec.loop ? { loop: true } : {}),
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// Loudness and peak of a file, from ffmpeg (EBU R128 integrated, true peak).
function measure(file, filters = '') {
  const log = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', (filters ? filters + ',' : '') + 'ebur128=peak=true,volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const num = (re) => { const all = [...log.matchAll(new RegExp(re, 'g'))]; return all.length ? parseFloat(all.at(-1)[1]) : -Infinity; };   // the summary is last
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), max: num(/max_volume:\s+(-?[\d.]+) dB/), mean: num(/mean_volume:\s+(-?[\d.]+) dB/) };
}

// Where the hit is: 5 ms before the first sample within 10 dB of the peak.
// (Trimming silence alone isn't enough: a faint blip can come before the hit.)
function onset(file) {
  const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 64 << 20 });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const i = x.findIndex(v => Math.abs(v) >= peak * 0.316);
  return Math.max(0, i / 44100 - 0.005);
}

// Make a loop seamless: fold its last 0.25 s over its start with an
// equal-power crossfade, so the final sample runs straight on into the first.
function loopify(raw, out) {
  const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', raw, '-ac', '2', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 64 << 20 });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  const frames = x.length / 2, X = Math.round(0.25 * 44100), L = frames - X;
  const y = new Float32Array(L * 2);
  for (let i = 0; i < L; i++) for (let c = 0; c < 2; c++) {
    let v = x[i * 2 + c];
    if (i < X) { const t = (i / X) * Math.PI / 2; v = x[(L + i) * 2 + c] * Math.cos(t) + v * Math.sin(t); }
    y[i * 2 + c] = v;
  }
  fs.writeFileSync(out, Buffer.from(y.buffer));
}

// One-shots: cut the silence before the transient, short fade at the tail.
// Loops: left whole so the seam stays seamless. Then every file is measured
// and set to the same loudness (short hits fall back on their RMS level),
// with a limiter holding peaks under -1.5 dB.
const TARGET = { shot: -20, loop: -22 };
function finish(raw, out, spec) {
  if (spec.loop) {                                   // work from the seamless version
    const pcm = raw + '.loop.f32';
    loopify(raw, pcm);
    const wav = raw + '.loop.wav';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', pcm, wav]);
    raw = wav;
  }
  const shape = spec.loop ? 'anull'
    : `atrim=start=${onset(raw).toFixed(4)},asetpts=PTS-STARTPTS${spec.max ? `,atrim=end=${spec.max}` : ''},afade=t=in:d=0.002,areverse,afade=t=in:d=0.04,areverse`;   // max: one hit per event
  const target = spec.loop ? TARGET.loop : TARGET.shot;
  const levelOf = (m) => (Number.isFinite(m.I) && m.I > -70 ? m.I : m.mean + 3);   // very short clips: gate leaves no I
  let gain = target - levelOf(measure(raw, shape));
  // encode, measure the result, and correct once more if it missed by over 1 LU
  for (let pass = 0; pass < 3; pass++) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      // (no limiter on loops: its look-ahead shifts the start and breaks the seam; they peak well under 0 dB)
      `${shape},volume=${gain.toFixed(2)}dB${spec.loop ? '' : ',alimiter=limit=0.84:attack=1:release=40:level=disabled'}`,
      '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2', out]);
    const miss = target - levelOf(measure(out));
    if (Math.abs(miss) <= 1) break;
    gain += miss;
  }
}

(async () => {
  const key = readEnv().ELEVENLABS_API_KEY;
  if (!key) { console.error('No ELEVENLABS_API_KEY in .env (or the environment).'); process.exit(1); }
  fs.mkdirSync(path.join(OUT, '.raw'), { recursive: true });
  const refinish = process.argv.includes('--refinish');      // reprocess downloaded files, no new generations
  const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { events: {} };
  manifest.base = './';
  for (const [ev, spec] of Object.entries(EVENTS)) {
    if (only.length && !only.includes(ev)) continue;
    const files = [];
    for (let i = 1; i <= spec.n; i++) {
      const name = `${ev}-${String(i).padStart(2, '0')}.mp3`;
      const raw = path.join(OUT, '.raw', name);
      process.stdout.write(`${name} … `);
      if (!(refinish && fs.existsSync(raw))) {
        // ElevenLabs now and then returns near silence: try again
        for (let tries = 1; ; tries++) {
          fs.writeFileSync(raw, await generate(key, spec));
          if (measure(raw).max > -30 || tries === 3) break;
          process.stdout.write('quiet, retrying … ');
        }
      }
      finish(raw, path.join(OUT, name), spec);
      files.push(name);
      console.log('ok');
    }
    manifest.events[ev] = { files, gain: spec.gain, pitch: spec.pitch, ...(spec.loop ? { loop: true } : {}) };
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${manifestPath}`);
})().catch(e => { console.error(e.message); process.exit(1); });
