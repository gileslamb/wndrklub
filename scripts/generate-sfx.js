#!/usr/bin/env node
// Generate the hero's sound effects with the ElevenLabs Sound Effects API.
// Run once, locally:   node scripts/generate-sfx.js [event ...]
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
  'cube-land':     { n: 4, secs: 0.7, gain: 0.8,  pitch: 2, text: 'A single small wooden cube landing on a wooden table, soft thud with a tiny bounce, close up, dry' },
  'splat':         { n: 2, secs: 0.8, gain: 0.7,  pitch: 2, text: 'A small wet playful paint splat, a cartoon blob of paint hitting paper, cute not gross, dry' },
  'stray-land':    { n: 2, secs: 0.9, gain: 0.9,  pitch: 2, text: 'A small wooden cube dropping from a little height onto a wooden table, a slightly bigger thud and one small bounce, dry' },
  'lemon-impact':  { n: 2, secs: 0.6, gain: 0.85, pitch: 2, text: 'A small wooden cube knocking into a lemon on a table, a soft dull thump' },
  'lemon-roll':    { n: 2, secs: 2.0, gain: 0.6,  pitch: 1, loop: true, text: 'A lemon rolling steadily across a wooden table, soft continuous rumble, seamless loop' },
  'lemon-settle':  { n: 2, secs: 1.0, gain: 0.6,  pitch: 2, text: 'A lemon rocking gently to a stop on a wooden table, a few soft taps fading out' },
  'cheese-impact': { n: 2, secs: 0.6, gain: 0.85, pitch: 2, text: 'A small wooden cube knocking into a block of cheese, a dense soft thump' },
  'cheese-roll':   { n: 4, secs: 0.5, gain: 0.7,  pitch: 2, text: 'A wedge of cheese tipping over onto a wooden table, one dense soft lumpy thud, dry' },
  'cheese-settle': { n: 2, secs: 0.8, gain: 0.6,  pitch: 2, text: 'A wedge of cheese settling on a wooden table, a heavy soft wobble and stop' },
  'fish-impact':   { n: 2, secs: 0.6, gain: 0.8,  pitch: 2, text: 'A small wooden cube bumping into a goldfish on a table, a soft wet bump, playful, not gross' },
  'fish-roll':     { n: 4, secs: 0.5, gain: 0.65, pitch: 3, text: 'A small goldfish flopping once on a wooden table, a tiny wet slap, playful cartoon, not gross' },
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

// One-shots: cut the silence before the transient, short fade at the tail.
// Loops: left whole so the seam stays seamless. Both: the same loudness target.
function finish(raw, out, spec) {
  const filters = spec.loop
    ? ['loudnorm=I=-20:TP=-1.5:LRA=7']
    : ['silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.004', 'areverse', 'afade=t=in:d=0.04', 'areverse', 'loudnorm=I=-18:TP=-1.5:LRA=7'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', filters.join(','), '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2', out]);
}

(async () => {
  const key = readEnv().ELEVENLABS_API_KEY;
  if (!key) { console.error('No ELEVENLABS_API_KEY in .env (or the environment).'); process.exit(1); }
  fs.mkdirSync(path.join(OUT, '.raw'), { recursive: true });
  const only = process.argv.slice(2);
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
      fs.writeFileSync(raw, await generate(key, spec));
      finish(raw, path.join(OUT, name), spec);
      files.push(name);
      console.log('ok');
    }
    manifest.events[ev] = { files, gain: spec.gain, pitch: spec.pitch, ...(spec.loop ? { loop: true } : {}) };
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${manifestPath}`);
})().catch(e => { console.error(e.message); process.exit(1); });
