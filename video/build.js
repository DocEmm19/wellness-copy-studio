#!/usr/bin/env node
// Script JSON -> validated -> (free local voiceover) -> HyperFrames project -> MP4.
//
//   node video/build.js video/scripts/3pm-crash.json            # voiceover + render
//   node video/build.js video/scripts/3pm-crash.json --no-voice # captions-only (faster)
//   node video/build.js video/scripts/3pm-crash.json --no-render  # just write the project, then `npx hyperframes preview`
//   node video/build.js video/scripts/*.json                    # batch
//
// Everything runs locally: Kokoro TTS and Chrome+FFmpeg rendering via the HyperFrames CLI. No paid APIs.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const lib = require('./video-lib');

const HF = 'hyperframes@0.8.156';
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--music', '--quality'].includes(args[i - 1])));

if (!files.length) { console.error('usage: node video/build.js <script.json>... [--no-voice] [--no-render] [--music file] [--quality draft|looks|delivery]'); process.exit(1); }

function hf(cmdArgs, cwd) {
  try {
    return execFileSync('npx', ['--yes', HF, ...cmdArgs], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } }).toString();
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    if (/kokoro/i.test(out)) throw new Error('Voiceover needs the free Kokoro model: pip install kokoro-onnx soundfile  (or pass --no-voice)');
    throw new Error(`hyperframes ${cmdArgs[0]} failed:\n${out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim()}`);
  }
}

function duration(file) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
}

function build(scriptPath) {
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
  const v = lib.validateScript(script);
  if (!v.ok) {
    console.error(`✗ ${scriptPath} fails the attention playbook:\n  - ` + v.errors.join('\n  - '));
    return false;
  }
  const scriptDir = path.dirname(path.resolve(scriptPath));
  const proj = path.join(__dirname, 'out', script.slug);
  const assets = path.join(proj, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  // GSAP is vendored (not CDN) so renders work offline and are reproducible
  fs.copyFileSync(require.resolve('gsap/dist/gsap.min.js'), path.join(assets, 'gsap.min.js'));

  // copy any per-scene media into the project so the composition is self-contained
  script.scenes.forEach((c, i) => {
    if (!c.media) return;
    const src = path.resolve(scriptDir, c.media);
    const dst = `assets/scene-${i}${path.extname(src)}`;
    fs.copyFileSync(src, path.join(proj, dst));
    c.media = dst;
  });

  let voice = null, durs = null;
  if (!flag('--no-voice') && script.voice !== false) {
    voice = []; durs = [];
    script.scenes.forEach((c, i) => {
      const rel = `assets/vo-${i}.wav`;
      process.stdout.write(`  voice ${i + 1}/${script.scenes.length}\r`);
      hf(['tts', c.say, '-v', script.voice || 'af_heart', '-s', String(script.speed || 1.1), '-o', rel], proj);
      voice.push(rel); durs.push(duration(path.join(proj, rel)));
    });
  }

  let music = null;
  const musicSrc = opt('--music') || (script.music && path.resolve(scriptDir, script.music));
  if (musicSrc) { music = 'assets/music' + path.extname(musicSrc); fs.copyFileSync(musicSrc, path.join(proj, music)); }

  const timeline = lib.planTimeline(script, durs);
  fs.writeFileSync(path.join(proj, 'index.html'), lib.buildComposition(script, timeline, { voice, music }));
  fs.writeFileSync(path.join(proj, 'meta.json'), JSON.stringify({ id: script.slug, name: script.title || script.slug }, null, 2));
  console.log(`✓ ${script.slug}: ${timeline.scenes.length} scenes, ${timeline.total}s → ${path.relative(process.cwd(), proj)}`);

  if (flag('--no-render')) return true;
  const out = path.join(__dirname, 'out', script.slug + '.mp4');
  hf(['render', '.', '-o', out, '-q', opt('--quality') || 'looks', '--quiet'], proj);
  console.log(`🎬 ${path.relative(process.cwd(), out)}`);
  return true;
}

let ok = true;
for (const f of files) {
  try { ok = build(f) && ok; } catch (e) { console.error('✗ ' + f + ': ' + e.message); ok = false; }
}
process.exit(ok ? 0 : 1);
