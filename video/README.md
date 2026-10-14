# Hook-driven video automation (free, local)

Claude writes the script, a validator applies attention-psychology rules,
Kokoro reads the voiceover locally, and [HyperFrames](https://github.com/heygen-com/hyperframes)
renders an MP4 with headless Chrome + FFmpeg. There are no paid APIs and no per-video cost.

```
topic ──▶ Claude (/make-video skill) ──▶ scripts/<slug>.json
                                              │  check.js (hook ≤2s, loop/payoff, pattern interrupts, no clinical claims)
                                              ▼
                       build.js ──▶ Kokoro TTS per scene ──▶ measured timings
                                              ▼
                       video-lib.js ──▶ out/<slug>/index.html (HyperFrames composition)
                                              ▼
                       hyperframes render ──▶ out/<slug>.mp4
```

## Setup (once)

```bash
npm install                          # vendored GSAP
pip install kokoro-onnx soundfile    # free voiceover; skip if you render with --no-voice
# Node 22+ and ffmpeg are required
```

## Use

In Claude Code, ask for a video:

> /make-video 3 hook variants about why people crash after lunch

Or run the steps yourself:

```bash
node video/check.js video/scripts/*.json        # validate against the playbook
node video/build.js video/scripts/3pm-crash.json --quality draft
node video/build.js video/scripts/*.json        # batch, final quality
npm test
```

Flags: `--no-voice` (captions only), `--no-render` (write the project, then
`cd video/out/<slug> && npx hyperframes preview` to tweak it in the studio),
`--music file.mp3`, `--quality draft|looks|delivery`.

## What makes it work

See **[HOOKS.md](HOOKS.md)**. In short:

- Each video uses one of seven hook types and gets a punch-in visual in the first 2s.
- The hook opens a loop that the payoff closes in the back half, and the CTA comes only after the payoff.
- The visual changes every 2–3s. Repeated styles are rejected, and longer videos need a mid-video re-hook.
- Captions pop in word by word with the accent word emphasised, a progress bar fills across the top, and the background tone flips on every scene.
- **A/B test the hooks.** Render 3 variants per idea and keep the hook type with the best 3-second hold.

## Files

| file | what |
|---|---|
| `HOOKS.md` | the attention playbook (Claude reads it before writing) |
| `video-lib.js` | pure logic: `validateScript`, `planTimeline`, `buildComposition` |
| `build.js` | script → TTS → composition → MP4 |
| `check.js` | validate scripts only |
| `scripts/` | example scripts (`3pm-crash` = question hook, `protein-breakfast` = contrarian) |
| `../.claude/skills/make-video/SKILL.md` | the Claude Code workflow |
