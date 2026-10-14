// Pure logic for the hook-driven video pipeline: validate a script, plan its timeline,
// and compile it into a HyperFrames composition (index.html). No I/O here — see build.js.

var HOOK_TYPES = ['curiosity_gap', 'contrarian', 'negative', 'specific_promise', 'callout', 'in_medias_res', 'question'];
var ROLES = ['hook', 'stakes', 'value', 'proof', 'rehook', 'payoff', 'cta'];
var STYLES = ['punch', 'kinetic', 'stat', 'list', 'contrast', 'cta'];
var FORMATS = { portrait: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
var BANNED = ['cure', 'cures', 'cured', 'diagnose', 'diagnosis', 'guaranteed', 'guarantee', 'miracle', '100%', 'detox your', 'reverse diabetes'];

var WORDS_PER_SEC = 3.2;   // measured Kokoro pace at speed 1.1; used when no audio is generated
var MIN_SCENE = 1.2;
var SCENE_PAD = 0.15;

function words(s) { s = String(s || '').trim(); return s ? s.split(/\s+/) : []; }

function validateScript(s) {
  var errs = [];
  if (!s || typeof s !== 'object') return { ok: false, errors: ['not an object'] };
  if (!/^[a-z0-9-]+$/.test(s.slug || '')) errs.push('slug must be kebab-case');
  if (s.format && !FORMATS[s.format]) errs.push('format must be one of ' + Object.keys(FORMATS).join(', '));
  if (HOOK_TYPES.indexOf(s.hook_type) < 0) errs.push('hook_type must be one of ' + HOOK_TYPES.join(', '));
  var sc = s.scenes;
  if (!Array.isArray(sc) || sc.length < 3) { errs.push('need at least 3 scenes'); return { ok: false, errors: errs }; }

  sc.forEach(function (c, i) {
    var tag = 'scene ' + i + ' (' + (c && c.role) + ')';
    if (ROLES.indexOf(c.role) < 0) errs.push(tag + ': bad role');
    if (STYLES.indexOf(c.style) < 0) errs.push(tag + ': style must be one of ' + STYLES.join(', '));
    if (typeof c.say !== 'string' || !c.say.trim()) errs.push(tag + ': missing say');
    if (words(c.say).length > 14) errs.push(tag + ': say >14 words — split it (change the screen every 2–3s)');
    if (c.emphasis && (c.onscreen || c.say || '').toLowerCase().indexOf(String(c.emphasis).toLowerCase()) < 0) errs.push(tag + ': emphasis not found in on-screen text');
    if (c.style === 'stat' && !c.stat) errs.push(tag + ': stat style needs "stat"');
    if (c.style === 'list' && !(Array.isArray(c.items) && c.items.length >= 2 && c.items.length <= 4)) errs.push(tag + ': list style needs 2–4 "items"');
    if (c.style === 'contrast' && !(c.old && c.new)) errs.push(tag + ': contrast style needs "old" and "new"');
    if (i > 0 && c.style === sc[i - 1].style && c.style !== 'kinetic') errs.push(tag + ': same style as previous scene — vary the visual');
    if (i > 1 && c.style === 'kinetic' && sc[i - 1].style === 'kinetic' && sc[i - 2].style === 'kinetic') errs.push(tag + ': 3 kinetic scenes in a row — add a pattern interrupt');
    var all = [c.say, c.onscreen, c.stat, c.label, c.old, c.new].concat(c.items || []).join(' ').toLowerCase();
    BANNED.forEach(function (b) { if (new RegExp('(^|[^a-z])' + b.replace(/[%]/g, '\\%') + '($|[^a-z])').test(all)) errs.push(tag + ': banned claim word "' + b + '"'); });
  });

  var hook = sc[0];
  if (hook.role !== 'hook') errs.push('first scene must be the hook');
  if (words(hook.say).length > 12) errs.push('hook say >12 words — must land in under 2s');
  if (words(hook.onscreen || hook.say).length > 8) errs.push('hook onscreen >8 words');
  if (sc.filter(function (c) { return c.role === 'hook'; }).length !== 1) errs.push('exactly one hook scene');

  var payoffIdx = sc.map(function (c) { return c.role; }).lastIndexOf('payoff');
  if (payoffIdx < 0) errs.push('missing payoff scene (close the loop the hook opened)');
  else if (payoffIdx < sc.length / 2) errs.push('payoff too early — keep the loop open until the back half');
  var ctas = sc.filter(function (c) { return c.role === 'cta'; });
  if (ctas.length > 1) errs.push('only one CTA');
  if (ctas.length && sc[sc.length - 1].role !== 'cta') errs.push('CTA must be the last scene');
  if (ctas.length && payoffIdx > sc.indexOf(ctas[0])) errs.push('CTA must come after the payoff');

  var est = estimateDuration(s);
  if (est < 12 || est > 75) errs.push('estimated length ' + est.toFixed(1) + 's — aim for 15–60s');
  if (est > 22 && !sc.some(function (c) { return c.role === 'rehook'; })) errs.push('videos over ~20s need a rehook scene mid-way');
  return { ok: errs.length === 0, errors: errs };
}

function sceneSeconds(c) { return Math.max(MIN_SCENE, words(c.say).length / WORDS_PER_SEC + 0.35); }

function estimateDuration(s) { return (s.scenes || []).reduce(function (t, c) { return t + sceneSeconds(c); }, 0); }

// audioDurations[i] (seconds) is the measured voiceover length for scene i, or null for the estimate.
function planTimeline(s, audioDurations) {
  var t = 0;
  var scenes = s.scenes.map(function (c, i) {
    var a = audioDurations && audioDurations[i];
    var d = a ? a + SCENE_PAD : sceneSeconds(c);
    d = Math.round(Math.max(MIN_SCENE, d) * 100) / 100;
    var out = { index: i, start: Math.round(t * 100) / 100, duration: d, scene: c };
    t += d;
    return out;
  });
  return { scenes: scenes, total: Math.round(t * 100) / 100 };
}

function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function wordSpans(text, emphasis, cls) {
  var emph = words(emphasis).map(function (w) { return w.toLowerCase().replace(/[^\w%$]/g, ''); });
  return words(text).map(function (w) {
    var hl = emph.indexOf(w.toLowerCase().replace(/[^\w%$]/g, '')) >= 0;
    return '<span class="' + cls + (hl ? ' hl' : '') + '">' + esc(w) + '</span>';
  }).join(' ');
}

// Returns { html, js } for one scene. Animation times are absolute (scene start + offset).
function renderScene(p, id) {
  var c = p.scene, s = p.start, d = p.duration, sel = '#' + id;
  var text = c.onscreen || c.say;
  var html = '', js = [];
  var media = '';
  if (c.media) {
    var isVid = /\.(mp4|webm|mov)$/i.test(c.media);
    media = isVid
      ? '<video class="bg" src="' + esc(c.media) + '" muted playsinline data-start="' + s + '" data-duration="' + d + '"></video>'
      : '<img class="bg" src="' + esc(c.media) + '" alt="">';
    js.push('tl.fromTo("' + sel + ' .bg",{scale:1.0},{scale:1.12,duration:' + d + ',ease:"none"},' + s + ');');
  }
  var shade = c.media ? '<div class="shade"></div>' : '';

  if (c.style === 'punch') {
    html = '<div class="center"><div class="punch">' + wordSpans(text, c.emphasis, 'w') + '</div></div>';
    js.push('tl.fromTo("' + sel + ' .punch",{scale:2.4,opacity:0},{scale:1,opacity:1,duration:0.28,ease:"power4.in"},' + s + ');');
    // deterministic camera shake on impact
    [6, -5, 4, -2, 0].forEach(function (x, k) { js.push('tl.to("' + sel + ' .punch",{x:' + x * 3 + ',rotation:' + x * 0.3 + ',duration:0.04},' + (s + 0.28 + k * 0.04).toFixed(2) + ');'); });
    js.push('tl.to("' + sel + ' .punch",{scale:1.06,duration:' + Math.max(0.5, d - 0.5).toFixed(2) + ',ease:"none"},' + (s + 0.5).toFixed(2) + ');');
  } else if (c.style === 'kinetic') {
    html = '<div class="center"><div class="kinetic">' + wordSpans(text, c.emphasis, 'w') + '</div></div>';
  } else if (c.style === 'stat') {
    html = '<div class="center col"><div class="stat">' + esc(c.stat) + '</div><div class="label">' + esc(c.label || text) + '</div></div>';
    js.push('tl.fromTo("' + sel + ' .stat",{scale:0.3,opacity:0},{scale:1,opacity:1,duration:0.45,ease:"back.out(2.2)"},' + s + ');');
    js.push('tl.fromTo("' + sel + ' .label",{y:40,opacity:0},{y:0,opacity:1,duration:0.35},' + (s + 0.3).toFixed(2) + ');');
  } else if (c.style === 'list') {
    html = '<div class="center col"><div class="title">' + wordSpans(text, c.emphasis, 't') + '</div><ul class="list">' +
      c.items.map(function (it, k) { return '<li class="li li' + k + '"><b>' + (k + 1) + '</b>' + esc(it) + '</li>'; }).join('') + '</ul></div>';
    js.push('tl.fromTo("' + sel + ' .title",{y:-30,opacity:0},{y:0,opacity:1,duration:0.3},' + s + ');');
    var gap = Math.min(0.6, (d - 0.6) / c.items.length);
    c.items.forEach(function (_, k) { js.push('tl.fromTo("' + sel + ' .li' + k + '",{x:-120,opacity:0},{x:0,opacity:1,duration:0.3,ease:"power3.out"},' + (s + 0.3 + k * gap).toFixed(2) + ');'); });
  } else if (c.style === 'contrast') {
    html = '<div class="split"><div class="half old"><i>✗</i><span>' + esc(c.old) + '</span></div><div class="half new"><i>✓</i><span>' + esc(c.new) + '</span></div></div>';
    js.push('tl.fromTo("' + sel + ' .old",{x:-200,opacity:0},{x:0,opacity:1,duration:0.3},' + s + ');');
    js.push('tl.to("' + sel + ' .old",{opacity:0.35,scale:0.94,duration:0.3},' + (s + d * 0.45).toFixed(2) + ');');
    js.push('tl.fromTo("' + sel + ' .new",{x:200,opacity:0},{x:0,opacity:1,duration:0.35,ease:"back.out(1.8)"},' + (s + d * 0.45).toFixed(2) + ');');
  } else if (c.style === 'cta') {
    html = '<div class="center col"><div class="kinetic small">' + wordSpans(text, c.emphasis, 'w') + '</div><div class="pill">' + esc(c.button || 'Save this') + '</div></div>';
    js.push('tl.fromTo("' + sel + ' .pill",{scale:0,opacity:0},{scale:1,opacity:1,duration:0.4,ease:"back.out(2.5)"},' + (s + 0.25).toFixed(2) + ');');
    for (var k = 0; s + 0.8 + k * 0.6 < s + d - 0.3; k++) {
      js.push('tl.to("' + sel + ' .pill",{scale:1.08,duration:0.25,yoyo:true,repeat:1},' + (s + 0.8 + k * 0.6).toFixed(2) + ');');
    }
  }

  // word-by-word pop for any element made of .w spans (kinetic captions), paced across the scene
  if (c.style === 'kinetic' || c.style === 'cta') {
    var n = words(text).length, step = Math.min(0.32, (d * 0.8) / Math.max(1, n));
    for (var w = 0; w < n; w++) {
      js.push('tl.fromTo("' + sel + ' .w:nth-of-type(' + (w + 1) + ')",{y:50,scale:0.6,opacity:0},{y:0,scale:1,opacity:1,duration:0.18,ease:"back.out(3)"},' + (s + w * step).toFixed(2) + ');');
    }
  }

  return {
    html: '<section id="' + id + '" class="clip scene ' + esc(c.style) + ' r-' + esc(c.role) + '" data-start="' + s + '" data-duration="' + d + '" data-track-index="1">' + media + shade + html + '</section>',
    js: js
  };
}

// timeline: from planTimeline. audio: { voice: ['assets/vo-0.wav', ...] | null, music: 'assets/music.mp3' | null }
function buildComposition(script, timeline, audio) {
  audio = audio || {};
  var dims = FORMATS[script.format || 'portrait'];
  var W = dims[0], H = dims[1], T = timeline.total;
  var b = Object.assign({ accent: '#e6006e', ink: '#ffffff', bg: '#0f3557', bg2: '#1c2b36', font: 'Inter, ui-sans-serif, system-ui, sans-serif' }, script.brand || {});
  var base = Math.round(W * (W < H ? 0.085 : 0.06));

  var parts = timeline.scenes.map(function (p) { return renderScene(p, 's' + p.index); });
  var audioTags = [];
  (audio.voice || []).forEach(function (src, i) {
    if (!src) return;
    var p = timeline.scenes[i];
    audioTags.push('<audio id="vo' + i + '" src="' + esc(src) + '" data-start="' + p.start + '" data-duration="' + p.duration + '" data-track-index="2" data-volume="1"></audio>');
  });
  if (audio.music) audioTags.push('<audio id="music" src="' + esc(audio.music) + '" data-start="0" data-duration="' + T + '" data-track-index="3" data-volume="' + (audio.voice ? 0.12 : 0.5) + '" data-fade-out="1"></audio>');

  // background colour flips between two brand tones each scene — a cheap, constant pattern interrupt
  var bgJs = timeline.scenes.map(function (p) {
    return 'tl.set("#bgA",{opacity:' + (p.index % 2 ? 0 : 1) + '},' + p.start + ');';
  });

  var css = [
    '*{margin:0;padding:0;box-sizing:border-box}',
    'html,body{width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:' + b.bg2 + '}',
    '#root{position:relative;width:100%;height:100%;font-family:' + b.font + ';color:' + b.ink + '}',
    '.layer{position:absolute;inset:0}',
    '#bgA{background:' + b.bg + ';opacity:0}',
    '.clip{position:absolute;inset:0}',
    '.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.65))}',
    '.center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 ' + Math.round(W * 0.08) + 'px;text-align:center}',
    '.col{flex-direction:column;gap:' + Math.round(base * 0.4) + 'px}',
    '.punch{font-size:' + Math.round(base * 1.35) + 'px;font-weight:900;line-height:1.02;letter-spacing:-.03em;text-transform:uppercase;text-shadow:0 8px 30px rgba(0,0,0,.35)}',
    '.kinetic{font-size:' + base + 'px;font-weight:800;line-height:1.15;letter-spacing:-.02em}',
    '.kinetic.small{font-size:' + Math.round(base * 0.8) + 'px}',
    '.w,.t{display:inline-block}',
    '.hl{color:' + b.accent + '}',
    '.r-hook .hl,.r-rehook .hl{background:' + b.accent + ';color:#fff;padding:0 .12em;border-radius:.12em}',
    '.stat{font-size:' + Math.round(base * 3) + 'px;font-weight:900;color:' + b.accent + ';line-height:1}',
    '.label{color:' + b.ink + ';font-size:' + Math.round(base * 0.7) + 'px;font-weight:700;max-width:90%}',
    '.title{font-size:' + Math.round(base * 0.8) + 'px;font-weight:800}',
    '.list{list-style:none;display:flex;flex-direction:column;gap:' + Math.round(base * 0.3) + 'px;width:100%;text-align:left}',
    '.li{font-size:' + Math.round(base * 0.62) + 'px;font-weight:700;background:rgba(255,255,255,.1);border-radius:24px;padding:' + Math.round(base * 0.25) + 'px ' + Math.round(base * 0.35) + 'px;display:flex;gap:.6em;align-items:center}',
    '.li b{background:' + b.accent + ';border-radius:50%;min-width:1.6em;height:1.6em;display:inline-flex;align-items:center;justify-content:center}',
    '.split{position:absolute;inset:0;display:flex;flex-direction:' + (W < H ? 'column' : 'row') + '}',
    '.half{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3em;padding:0 8%;text-align:center;font-size:' + Math.round(base * 0.75) + 'px;font-weight:800}',
    '.half i{font-style:normal;font-size:1.6em}',
    '.old{background:rgba(0,0,0,.25)}.old i{color:#ff5a5a}.new i{color:#3ee08f}',
    '.pill{background:' + b.accent + ';color:#fff;font-size:' + Math.round(base * 0.7) + 'px;font-weight:800;padding:.45em 1.2em;border-radius:999px;box-shadow:0 12px 40px rgba(0,0,0,.35)}',
    '#progress{position:absolute;top:0;left:0;height:' + Math.max(8, Math.round(H * 0.006)) + 'px;width:100%;background:' + b.accent + ';transform-origin:0 50%;z-index:10}',
    '#brand{position:absolute;bottom:' + Math.round(H * 0.04) + 'px;width:100%;text-align:center;font-size:' + Math.round(base * 0.38) + 'px;font-weight:700;opacity:.75;z-index:10}'
  ].join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=' + W + ', height=' + H + '" />',
    '<!-- generated by video/build.js from scripts/' + esc(script.slug) + '.json — edit the script, not this file -->',
    '<script src="assets/gsap.min.js"></script>',
    '<style>', css, '</style>',
    '</head>',
    '<body>',
    '<div id="root" data-composition-id="main" data-start="0" data-duration="' + T + '" data-width="' + W + '" data-height="' + H + '">',
    '<div id="bgA" class="layer"></div>',
    parts.map(function (x) { return x.html; }).join('\n'),
    '<div id="progress"></div>',
    script.handle ? '<div id="brand">' + esc(script.handle) + '</div>' : '',
    audioTags.join('\n'),
    '</div>',
    '<script>',
    'const tl = gsap.timeline({ paused: true });',
    'tl.fromTo("#progress",{scaleX:0},{scaleX:1,duration:' + T + ',ease:"none"},0);',
    bgJs.join('\n'),
    parts.map(function (x) { return x.js.join('\n'); }).join('\n'),
    'window.__timelines = window.__timelines || {};',
    'window.__timelines["main"] = tl;',
    'tl.seek(0);',
    '</script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateScript, planTimeline, buildComposition, estimateDuration, HOOK_TYPES, ROLES, STYLES, FORMATS };
}
