# Attention playbook for short-form video

This is the set of rules Claude follows when it writes a video script. `video-lib.js`
checks the rules that code can check. The rest is listed here so the script
writer, whether Claude or a person, applies them.

The goal is a video that people keep watching because the promise in the
first second is real and gets paid off. Clickbait that never delivers gets
skipped and lowers reach. A hook that delivers gets rewatched and shared.

---

## 1. The first 1–2 seconds (the hook)

Viewers decide almost immediately whether to keep watching. The hook scene must:

- **Fit in under 2 seconds.** Spoken line ≤ 12 words, on-screen text ≤ 8 words. (validated)
- **Start mid-thought.** No "Hi guys", no logo intro, no "In this video…".
- **Show the payoff's shape without giving it away.** That gap is what keeps people watching.
- **Use a `punch` visual.** Big type that lands with motion is a visual pattern interrupt.

Pick **one** hook type and set it in `hook_type`:

| `hook_type`         | Psychology                       | Template                                              |
|---------------------|----------------------------------|-------------------------------------------------------|
| `curiosity_gap`     | Information-gap theory (Loewenstein) | "The one thing your blood test won't tell you"    |
| `contrarian`        | Expectation violation            | "Stop drinking water first thing in the morning"      |
| `negative`          | Loss aversion / negativity bias  | "You're wasting your protein shake"                   |
| `specific_promise`  | Specificity reads as credibility | "3 swaps that cut sugar cravings in a week"           |
| `callout`           | Self-relevance (cocktail-party effect) | "If you wake up tired after 8 hours, watch this" |
| `in_medias_res`     | Narrative transportation         | "Day 21 — and my energy finally came back"            |
| `question`          | Self-generated curiosity         | "Why do you crash at 3pm every day?"                  |

## 2. Retention mechanics (seconds 2 to end)

- **Change something on screen every 2–3 seconds.** Each scene's spoken line is capped
  at ~10 words, and two scenes in a row can't use the same visual style. (validated)
- **Open a loop and close it late.** The hook opens a question. The `payoff` scene answers
  it in the back half of the video, not earlier. (validated)
- **Re-hook in the middle.** In videos over ~20s, put a `rehook` scene ("But here's the part
  nobody mentions…") in the middle third to reset attention.
- **Captions are always on.** Many people watch with the sound off, so captions appear
  word by word, with one emphasised word per scene in the accent colour.
- **Progress bar.** A thin bar fills across the top. Seeing the end approach keeps people
  watching to the finish (goal-gradient effect).
- **Concrete over abstract.** Use numbers, named foods, real times of day.
  Write "2 eggs at 8am", not "a good breakfast".

## 3. The ending

- **One CTA, one verb.** "Save this for your next grocery run." Multiple asks dilute each other.
- **Loopable last line (optional, `loop: true`).** Write the last line so it flows back into
  the hook. Replays count as watch time.
- **Earned CTA.** The CTA comes *after* the payoff, never before it.

## 4. Honesty and compliance guardrails (wellness)

These are hard rules, and the validator rejects scripts that break them:

- No clinical, diagnosis, or cure claims (`cure`, `diagnose`, `treat`, `guaranteed`, `miracle`, `100%`…).
- No fake urgency ("only today!") unless the offer is real.
- The payoff must deliver what the hook promised. If the hook says "3 swaps", show 3 swaps.

## 5. Scene roles

`hook` → (`stakes`) → `value` × N → (`rehook`) → `payoff` → `cta`

| role       | job                                                         |
|------------|-------------------------------------------------------------|
| `hook`     | stop the scroll, open the loop                              |
| `stakes`   | why this matters to *you* (cost of not knowing)             |
| `value`    | one idea per scene: a tip, step, or fact                    |
| `proof`    | number, study, before/after (honest, no overclaiming)       |
| `rehook`   | reset attention mid-video                                   |
| `payoff`   | close the loop the hook opened                              |
| `cta`      | one clear action                                            |

## 6. Visual styles

| style      | what it renders                                   | best for            |
|------------|---------------------------------------------------|---------------------|
| `punch`    | huge text that slams in with a shake              | hook, rehook        |
| `kinetic`  | word-by-word captions that pop in                 | value, stakes       |
| `stat`     | giant number + label                              | proof               |
| `list`     | bullet items stagger in                           | value with steps    |
| `contrast` | ✗ old way vs ✓ new way split                      | contrarian payoff   |
| `cta`      | pulsing action pill                               | cta                 |

Any scene can also take `media` (a path to an image or video file). It plays full-bleed
behind the text with a slow push-in.
