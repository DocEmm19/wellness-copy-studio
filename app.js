// Committed config constant — NOT a secret (the passcode is the gate).
// Replace with your deployed Web App /exec URL (see DEPLOY_RUNBOOK.md).
var WEBAPP_URL = window.WCS_URL || 'https://script.google.com/macros/s/AKfycbx0w17tHVAXiS0LxSkaM0fLmlyw5pspldRrJU1nCB5bFe6OL7B9inedGjyEkJbQGQPKyA/exec';

var LABELS = { diet: 'Diet', fitness: 'Fitness', stress: 'Stress Management', supplements: 'Supplements' };
var ICONS = { diet: '🥗', fitness: '🏃', stress: '🧘', supplements: '💊' };
var PILLARS = ['diet', 'fitness', 'stress', 'supplements'];

var $ = function (id) { return document.getElementById(id); };
var allTouchpoints = [];
var candidatePass = null;
var current = {};          // live per-pillar copy (reflects inline edits + refines)
var currentTouchpoint = '';

function api(action, extra) {
  var body = Object.assign({ action: action, pass: (candidatePass != null ? candidatePass : localStorage.getItem('wcs_pass')) || '' }, extra || {});
  return fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight to Apps Script
    body: JSON.stringify(body)
  }).then(function (r) { return r.json(); });
}

function showApp() { $('gate').classList.add('hidden'); $('app').classList.remove('hidden'); }
function showGate(msg) {
  $('app').classList.add('hidden'); $('gate').classList.remove('hidden');
  if (msg) { $('gateMsg').textContent = msg; $('gateMsg').className = 'helper err'; }
}

function loadTouchpoints() {
  return api('touchpoints').then(function (res) {
    if (res.error === 'unauthorized') { localStorage.removeItem('wcs_pass'); candidatePass = null; showGate('Passcode incorrect — try again.'); return; }
    if (!res.ok) { candidatePass = null; showGate('Could not reach the master sheet.'); return; }
    if (candidatePass != null) { localStorage.setItem('wcs_pass', candidatePass); candidatePass = null; }
    allTouchpoints = res.touchpoints.map(function (t) { return t.name; });
    renderOptions(allTouchpoints);
    showApp();
  });
}

function renderOptions(names) {
  var sel = $('touchpoint');
  sel.innerHTML = '';
  names.forEach(function (n) {
    var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
  });
}

function segHTML(segs) {
  return segs.map(function (s) {
    var t = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return s.hl ? '<span class="hl">' + t + '</span>' : t;
  }).join('');
}

function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function renderCards(pillars) {
  current = {};
  PILLARS.forEach(function (p) { if (pillars[p]) current[p] = pillars[p]; });
  var wrap = $('cards'); wrap.innerHTML = '';
  PILLARS.forEach(function (p) {
    if (!current[p]) return;
    var card = document.createElement('div');
    card.id = 'card-' + p;
    wrap.appendChild(card);
    renderCard(p);
  });
}

function optScope(sel, v) { return '<option value="' + v + '"' + (sel === v ? ' selected' : '') + '>' + v + '</option>'; }

function renderCard(p) {
  var c = current[p];
  var card = $('card-' + p);
  if (!card || !c) return;
  var e = splitEmphasis(c.headline_line1, c.headline_line2, c.emphasis, c.emphasis_scope);
  var na = c.relevance === 'na';
  card.className = 'card' + (na ? ' na' : '');
  card.innerHTML =
    '<h3>' + ICONS[p] + ' ' + LABELS[p] +
      (na ? '<span class="badge">Not typically used here</span>' : (c.relevance === 'secondary' ? '<span class="badge">secondary</span>' : '')) + '</h3>' +
    '<div class="headline">' + segHTML(e.line1) + '<br>' + segHTML(e.line2) + '</div>' +
    '<div class="subline">' + esc(c.subline) + '</div>' +
    '<details class="edit">' +
      '<summary>Edit text</summary>' +
      '<label>Line 1 <input class="in" id="' + p + '-h1" value="' + esc(c.headline_line1) + '"></label>' +
      '<label>Line 2 <input class="in" id="' + p + '-h2" value="' + esc(c.headline_line2) + '"></label>' +
      '<label>Emphasis <input class="in" id="' + p + '-emph" value="' + esc(c.emphasis) + '"></label>' +
      '<label>Scope <select class="in" id="' + p + '-scope">' + optScope(c.emphasis_scope, 'word') + optScope(c.emphasis_scope, 'line') + optScope(c.emphasis_scope, 'all') + '</select></label>' +
      '<label>Subline <input class="in" id="' + p + '-sub" value="' + esc(c.subline) + '"></label>' +
      '<button class="sec applyEdit">Apply changes</button>' +
    '</details>' +
    '<div class="refine"><input id="' + p + '-fb" placeholder="Tell AI how to fix it…"><button class="ai refineBtn">Refine</button></div>' +
    '<div class="fields">' +
      '<button class="sec copyall">Copy all</button>' +
      '<button class="sec copyh">Copy headline</button>' +
      '<button class="sec copys">Copy subline</button>' +
      '<button class="save saveBtn">Save to sheet</button>' +
    '</div>' +
    '<div class="cardmsg" id="' + p + '-msg"></div>';
  card.querySelector('.applyEdit').addEventListener('click', function () {
    c.headline_line1 = $(p + '-h1').value;
    c.headline_line2 = $(p + '-h2').value;
    c.emphasis = $(p + '-emph').value;
    c.emphasis_scope = $(p + '-scope').value;
    c.subline = $(p + '-sub').value;
    renderCard(p);
  });
  card.querySelector('.refineBtn').addEventListener('click', function () { refineCard(p); });
  card.querySelector('.saveBtn').addEventListener('click', function () { saveCard(p); });
  card.querySelector('.copyall').addEventListener('click', function () { navigator.clipboard.writeText(c.headline_line1 + ' ' + c.headline_line2 + '\n' + c.subline); });
  card.querySelector('.copyh').addEventListener('click', function () { navigator.clipboard.writeText(c.headline_line1 + ' ' + c.headline_line2); });
  card.querySelector('.copys').addEventListener('click', function () { navigator.clipboard.writeText(c.subline); });
}

function cardMsg(p, text, err) { var m = $(p + '-msg'); if (m) { m.textContent = text; m.className = 'cardmsg' + (err ? ' err' : ''); } }

function refineCard(p) {
  var fb = ($(p + '-fb').value || '').trim();
  if (!fb) { cardMsg(p, 'Type a change first.', true); return; }
  cardMsg(p, 'Refining…');
  api('refine', { touchpoint: currentTouchpoint, pillar: p, current: current[p], feedback: fb }).then(function (res) {
    if (res.error === 'unauthorized') { localStorage.removeItem('wcs_pass'); showGate('Passcode incorrect — try again.'); return; }
    if (res.error === 'daily_cap') { cardMsg(p, 'Daily limit reached — try tomorrow.', true); return; }
    if (!res.ok || !res.copy) { cardMsg(p, "Couldn't refine — try again.", true); return; }
    current[p] = res.copy; renderCard(p); cardMsg(p, 'Refined ✓');
  });
}

function saveCard(p) {
  if (!window.confirm('Save this ' + LABELS[p] + " copy for '" + currentTouchpoint + "' to the master sheet?")) return;
  cardMsg(p, 'Saving…');
  api('save', { touchpoint: currentTouchpoint, pillar: p, copy: current[p] }).then(function (res) {
    if (res.error === 'unauthorized') { localStorage.removeItem('wcs_pass'); showGate('Passcode incorrect — try again.'); return; }
    if (res.error === 'invalid') { cardMsg(p, 'Copy exceeds limits — shorten the headline/subline or fix the emphasis, then Save again.', true); return; }
    if (!res.ok) { cardMsg(p, "Couldn't save — try again.", true); return; }
    cardMsg(p, '✓ Saved to sheet');
  });
}

function saveAll() {
  if (!window.confirm("Save all 4 pillars for '" + currentTouchpoint + "' to the master sheet?")) return;
  $('status').textContent = 'Saving all…';
  var jobs = PILLARS.filter(function (p) { return current[p]; }).map(function (p) {
    return api('save', { touchpoint: currentTouchpoint, pillar: p, copy: current[p] }).then(function (res) {
      var okv = res && res.ok;
      var msg = okv ? '✓ Saved to sheet' : (res && res.error === 'invalid' ? 'Copy exceeds limits — fix it, then Save again.' : "Couldn't save — try again.");
      cardMsg(p, msg, !okv);
      return okv;
    });
  });
  Promise.all(jobs).then(function (oks) {
    var n = oks.filter(Boolean).length;
    $('status').textContent = 'Saved ' + n + '/' + oks.length + ' to sheet.';
  });
}

function generate() {
  var tp = $('touchpoint').value;
  if (!tp) return;
  currentTouchpoint = tp;
  $('status').textContent = 'Generating… (each Generate is a fresh AI call)';
  $('status').className = 'msg';
  api('generate', { touchpoint: tp }).then(function (res) {
    if (res.error === 'unauthorized') { localStorage.removeItem('wcs_pass'); showGate('Passcode incorrect — try again.'); return; }
    if (res.error === 'daily_cap') { $('status').textContent = 'Daily limit reached — try again tomorrow.'; return; }
    if (!res.ok) { $('status').textContent = "Couldn't generate — try again."; $('status').className = 'msg err'; return; }
    $('status').textContent = 'Done — click Generate again to get fresh variants.';
    renderCards(res.pillars);
  });
}

function init() {
  $('unlock').addEventListener('click', function () {
    candidatePass = $('pass').value;
    loadTouchpoints();
  });
  $('generate').addEventListener('click', generate);
  $('saveall').addEventListener('click', saveAll);
  $('filter').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    renderOptions(allTouchpoints.filter(function (n) { return n.toLowerCase().indexOf(q) >= 0; }));
  });
  if (localStorage.getItem('wcs_pass')) loadTouchpoints(); else showGate();
}
document.addEventListener('DOMContentLoaded', init);
