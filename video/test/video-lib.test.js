const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lib = require('../video-lib');

const example = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', '3pm-crash.json'), 'utf8'));
const errs = (s) => lib.validateScript(s).errors.join(' | ');

test('every bundled example script passes the playbook', () => {
  const dir = path.join(__dirname, '..', 'scripts');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const v = lib.validateScript(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    assert.ok(v.ok, f + ': ' + v.errors.join('; '));
  }
});

test('hook must be first and short', () => {
  const s = example();
  s.scenes[0].say = 'So today I want to talk to you about something that a lot of people ask me';
  assert.match(errs(s), /hook say >12 words/);
  const t = example();
  t.scenes.push(t.scenes.shift());
  assert.match(errs(t), /first scene must be the hook/);
});

test('payoff must close the loop in the back half, before the CTA', () => {
  const s = example();
  const payoff = s.scenes.splice(5, 1)[0];
  s.scenes.splice(1, 0, payoff);
  assert.match(errs(s), /payoff too early/);
  const t = example();
  t.scenes = t.scenes.filter((c) => c.role !== 'payoff');
  assert.match(errs(t), /missing payoff/);
});

test('visual must change between scenes', () => {
  const s = example();
  s.scenes[2] = Object.assign({}, s.scenes[2], { style: 'punch', onscreen: 'x' });
  s.scenes[3].style = 'punch';
  assert.match(errs(s), /same style as previous scene/);
});

test('long scenes are rejected', () => {
  const s = example();
  s.scenes[1].say = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';
  assert.match(errs(s), /say >14 words/);
});

test('clinical claims are rejected but innocent words are not', () => {
  const s = example();
  s.scenes[2].say = 'This simple swap will cure your fatigue.';
  assert.match(errs(s), /banned claim word "cure"/);
  const t = example();
  t.scenes[2].say = 'Secure a protein-rich lunch, a small treat is fine.';
  assert.ok(lib.validateScript(t).ok, errs(t));
});

test('single CTA, last', () => {
  const s = example();
  s.scenes.splice(2, 0, Object.assign({}, s.scenes[6]));
  assert.match(errs(s), /only one CTA/);
});

test('planTimeline uses measured audio when given, estimate otherwise', () => {
  const s = example();
  const est = lib.planTimeline(s);
  assert.strictEqual(est.scenes[0].start, 0);
  assert.strictEqual(est.scenes[1].start, est.scenes[0].duration);
  const real = lib.planTimeline(s, s.scenes.map(() => 2));
  assert.strictEqual(real.scenes[0].duration, 2.15);
  assert.strictEqual(real.total, Math.round(7 * 2.15 * 100) / 100);
});

test('buildComposition emits a valid HyperFrames root with every scene timed', () => {
  const s = example();
  const tl = lib.planTimeline(s);
  const html = lib.buildComposition(s, tl, { voice: s.scenes.map((_, i) => 'assets/vo-' + i + '.wav') });
  assert.match(html, /data-composition-id="main"/);
  assert.match(html, /window\.__timelines\["main"\] = tl/);
  assert.match(html, /gsap\.timeline\(\{ paused: true \}\)/);
  tl.scenes.forEach((p) => {
    assert.ok(html.includes('id="s' + p.index + '" class="clip'), 'scene ' + p.index);
    assert.ok(html.includes('id="vo' + p.index + '" src="assets/vo-' + p.index + '.wav" data-start="' + p.start + '"'));
  });
  assert.ok(!/Math\.random|Date\.now/.test(html), 'must be deterministic');
  assert.match(html, /<span class="w hl">3pm\?<\/span>|<span class="w hl">3pm/i);
});

test('buildComposition escapes script text', () => {
  const s = example();
  s.scenes[1].onscreen = '<img src=x onerror=alert(1)>';
  s.scenes[1].emphasis = '';
  const html = lib.buildComposition(s, lib.planTimeline(s), {});
  assert.ok(!html.includes('<img src=x'));
});
