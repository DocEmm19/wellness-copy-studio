---
name: make-video
description: Turn a topic, touchpoint, or article into a short-form vertical video (Reels/Shorts/TikTok) built on attention-hook psychology, rendered free and locally with HyperFrames. Use when the user asks to make, script, or batch videos, or to A/B test hooks.
---

# make-video

You are the scriptwriter and editor. The pipeline in `video/` does the rendering.
Everything is free: you write the script, Kokoro does the voiceover locally,
and HyperFrames renders with local Chrome + FFmpeg.

## 0. One-time setup (skip if already done)

```bash
npm install                          # vendored GSAP
pip install kokoro-onnx soundfile    # free local voiceover (skip if you only want --no-voice)
which ffmpeg                         # required by HyperFrames
```

## 1. Read the playbook

Read `video/HOOKS.md` in full before you write anything. It holds the rules on hook
types, scene roles, visual styles, and the honesty guardrails. `video/scripts/*.json`
are worked examples of the schema.

## 2. Pin down the brief (ask only what you can't infer)

- **Who is watching and what do they want?** One specific viewer, e.g. "office worker who crashes after lunch".
- **The single takeaway.** If it takes two sentences, it's two videos.
- **Platform/format:** `portrait` (default), `square`, `landscape`.
- **Variants:** default to **3 hook variants** so the user can A/B test (step 4).

## 3. Write the script JSON

Write it at `video/scripts/<slug>.json` using this schema:

```jsonc
{
  "slug": "kebab-case",            // output name
  "title": "…",
  "format": "portrait",
  "hook_type": "curiosity_gap|contrarian|negative|specific_promise|callout|in_medias_res|question",
  "voice": "af_heart",             // or false for captions-only; see `npx hyperframes tts --list`
  "speed": 1.1,
  "handle": "@brand",              // optional watermark
  "brand": { "accent": "#e6006e", "bg": "#0f3557", "bg2": "#1c2b36" },
  "music": "path/to/royalty-free.mp3",   // optional, relative to the script
  "scenes": [
    { "role": "hook", "style": "punch", "say": "spoken line", "onscreen": "≤8 words", "emphasis": "word" },
    { "role": "value", "style": "list", "say": "…", "onscreen": "title", "items": ["…", "…", "…"] },
    { "role": "proof", "style": "stat", "say": "…", "stat": "73%", "label": "…" },
    { "role": "value", "style": "contrast", "say": "…", "old": "old way", "new": "new way" },
    { "role": "value", "style": "kinetic", "say": "…", "onscreen": "…", "emphasis": "…", "media": "broll/clip.mp4" },
    { "role": "cta", "style": "cta", "say": "…", "onscreen": "…", "button": "Save this" }
  ]
}
```

How to write it:
- `say` is what the viewer hears. `onscreen` is a shorter, punchier version they read. Don't caption the voiceover word for word.
- Write `say` the way people talk: contractions, short words, one idea per scene.
- Only use numbers and claims you can support. Never invent statistics. If you have no real number, use `contrast` or `list` instead of `stat`.
- For a wellness brand, follow the voice rules in `copy-lib.js` `buildMessages`: second person, aspirational, no clinical claims.

## 4. Hook variants (A/B testing)

For each video, write 3 scripts that are identical except for scene 0 and `hook_type`
(slugs `<slug>-a`, `-b`, `-c`). Use three *different* hook types. Post all three; the hook
with the best 3-second hold rate wins, and that hook type becomes the default for the next
batch. Measuring which hook keeps viewers works better than guessing.

## 5. Validate → fix → repeat

```bash
node video/check.js video/scripts/<slug>*.json
```

Fix every error. The checks encode the attention rules, so don't work around them.
If a scene is too long, split it into two scenes with different styles.

## 6. Render

```bash
node video/build.js video/scripts/<slug>*.json --quality draft   # fast preview
node video/build.js video/scripts/<slug>*.json                   # final
# --no-voice  captions-only   --no-render  write project only   --music file.mp3
```

Output: `video/out/<slug>.mp4`. Editable HyperFrames project: `video/out/<slug>/`
(open it in the studio with `cd video/out/<slug> && npx hyperframes preview`).

## 7. Look at it before you hand it over

Make a contact sheet and **read the image**:

```bash
ffmpeg -v error -y -i video/out/<slug>.mp4 -vf "fps=1,scale=216:-1,tile=8x2" -frames:v 1 /tmp/<slug>-sheet.png
```

Check for: text clipped or overflowing, an unreadable emphasis colour, a hook frame
that doesn't make sense with the sound off, and dead seconds with nothing changing.
Fix the script and re-render.

## 8. Report

Give the MP4 paths, each variant's hook line and hook type, length, and what to
measure (3-second hold, average watch %, saves). Keep the report short.
