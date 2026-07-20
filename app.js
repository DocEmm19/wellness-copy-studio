// Committed config constant — NOT a secret (the passcode is the gate).
// Replace with your deployed Web App /exec URL (see DEPLOY_RUNBOOK.md).
var WEBAPP_URL = window.WCS_URL || 'https://script.google.com/macros/s/AKfycbx0w17tHVAXiS0LxSkaM0fLmlyw5pspldRrJU1nCB5bFe6OL7B9inedGjyEkJbQGQPKyA/exec';

var LABELS = { diet: 'Diet', fitness: 'Fitness', stress: 'Stress Management', supplements: 'Supplements' };
var ICONS = { diet: '🥗', fitness: '🏃', stress: '🧘', supplements: '💊' };
var PILLARS = ['diet', 'fitness', 'stress', 'supplements'];

var $ = function (id) { return document.getElementById(id); };
var allTouchpoints = [];
var candidatePass = null;

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

function renderCards(pillars) {
  var wrap = $('cards'); wrap.innerHTML = '';
  PILLARS.forEach(function (p) {
    var c = pillars[p]; if (!c) return;
    var e = splitEmphasis(c.headline_line1, c.headline_line2, c.emphasis, c.emphasis_scope);
    var na = c.relevance === 'na';
    var card = document.createElement('div');
    card.className = 'card' + (na ? ' na' : '');
    card.innerHTML =
      '<h3>' + ICONS[p] + ' ' + LABELS[p] +
        (na ? '<span class="badge">Not typically used here</span>' : (c.relevance === 'secondary' ? '<span class="badge">secondary</span>' : '')) + '</h3>' +
      '<div class="headline">' + segHTML(e.line1) + '<br>' + segHTML(e.line2) + '</div>' +
      '<div class="subline">' + c.subline.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
      '<div class="fields">' +
        '<button class="sec copyall">Copy all</button>' +
        '<button class="sec copy" data-v="' + encodeURIComponent(c.headline_line1 + ' ' + c.headline_line2) + '">Copy headline</button>' +
        '<button class="sec copy" data-v="' + encodeURIComponent(c.subline) + '">Copy subline</button>' +
      '</div>';
    var full = c.headline_line1 + ' ' + c.headline_line2 + '\n' + c.subline;
    card.querySelector('.copyall').addEventListener('click', function () { navigator.clipboard.writeText(full); });
    card.querySelectorAll('.copy').forEach(function (b) {
      b.addEventListener('click', function () { navigator.clipboard.writeText(decodeURIComponent(b.getAttribute('data-v'))); });
    });
    wrap.appendChild(card);
  });
}

function generate() {
  var tp = $('touchpoint').value;
  if (!tp) return;
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
  $('filter').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    renderOptions(allTouchpoints.filter(function (n) { return n.toLowerCase().indexOf(q) >= 0; }));
  });
  if (localStorage.getItem('wcs_pass')) loadTouchpoints(); else showGate();
}
document.addEventListener('DOMContentLoaded', init);
