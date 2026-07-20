// Shared pure logic for Wellness Copy Studio.
// Works unchanged as: Node module (require), browser global (<script>), Apps Script .gs file.
// Keep every function a top-level declaration so Apps Script exposes it globally.

function stripPII(text) {
  if (text == null) return '';
  // Replace any run of 10+ digits (spaces/hyphens allowed between digits) with a single space.
  return String(text).replace(/(?:\d[\s-]?){10,}\d?/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function _norm(s) { return String(s || '').toLowerCase().trim(); }

// Whole-token span split of `line` on `emphasis`. Returns Seg[] or null if not a clean token match.
function _spanSplit(line, emphasis) {
  if (!line || !emphasis) return null;
  const target = String(emphasis).trim();
  const idx = line.toLowerCase().indexOf(target.toLowerCase());
  if (idx < 0) return null;
  const end = idx + target.length;
  const before = idx === 0 ? ' ' : line[idx - 1];
  const after = end >= line.length ? ' ' : line[end];
  if (/[\w-]/.test(before) || /[\w-]/.test(after)) return null; // not a whole token (hyphen is word-joining, so "Stress" won't match inside "Stress-Free")
  const segs = [];
  if (idx > 0) segs.push({ text: line.slice(0, idx), hl: false });
  segs.push({ text: line.slice(idx, end), hl: true });
  if (end < line.length) segs.push({ text: line.slice(end), hl: false });
  return segs;
}

function splitEmphasis(line1, line2, emphasis, scope) {
  line1 = line1 == null ? '' : String(line1);
  line2 = line2 == null ? '' : String(line2);
  if (scope === 'all') {
    return { line1: [{ text: line1, hl: true }], line2: [{ text: line2, hl: true }] };
  }
  if (scope === 'line') {
    const inLine1 = _norm(line1).indexOf(_norm(emphasis)) >= 0;
    return inLine1
      ? { line1: [{ text: line1, hl: true }], line2: [{ text: line2, hl: false }] }
      : { line1: [{ text: line1, hl: false }], line2: [{ text: line2, hl: true }] };
  }
  // scope === 'word' (default). If the span matches in both lines, prefer line1 (intentional, stable tie-break).
  const s1 = _spanSplit(line1, emphasis);
  if (s1) return { line1: s1, line2: [{ text: line2, hl: false }] };
  const s2 = _spanSplit(line2, emphasis);
  if (s2) return { line1: [{ text: line1, hl: false }], line2: s2 };
  // fallback: highlight all of line2
  return { line1: [{ text: line1, hl: false }], line2: [{ text: line2, hl: true }] };
}

var WCS_PILLARS = ['diet', 'fitness', 'stress', 'supplements'];
var WCS_SCOPES = ['word', 'line', 'all'];
var WCS_RELEVANCE = ['primary', 'secondary', 'na'];

function _wordCount(s) { s = String(s || '').trim(); return s ? s.split(/\s+/).length : 0; }

function validateGeneration(pillars) {
  if (!pillars || typeof pillars !== 'object') return { ok: false, reason: 'not an object' };
  for (var i = 0; i < WCS_PILLARS.length; i++) {
    var p = WCS_PILLARS[i], c = pillars[p];
    if (!c || typeof c !== 'object') return { ok: false, reason: 'missing pillar ' + p };
    var fields = ['headline_line1', 'headline_line2', 'emphasis', 'emphasis_scope', 'subline', 'relevance'];
    for (var f = 0; f < fields.length; f++) {
      if (typeof c[fields[f]] !== 'string') return { ok: false, reason: p + ' missing ' + fields[f] };
    }
    if (WCS_SCOPES.indexOf(c.emphasis_scope) < 0) return { ok: false, reason: p + ' bad scope' };
    if (WCS_RELEVANCE.indexOf(c.relevance) < 0) return { ok: false, reason: p + ' bad relevance' };
    var lines = [c.headline_line1, c.headline_line2];
    for (var l = 0; l < lines.length; l++) {
      if (_wordCount(lines[l]) > 4) return { ok: false, reason: p + ' headline >4 words' };
      if (lines[l].length > 20) return { ok: false, reason: p + ' headline >20 chars' };
    }
    var sub = c.subline.split('\n');
    if (sub.length > 2) return { ok: false, reason: p + ' subline >2 lines' };
    for (var s = 0; s < sub.length; s++) {
      if (_wordCount(sub[s]) > 5) return { ok: false, reason: p + ' subline line >5 words' };
    }
    if (c.emphasis_scope !== 'all') {
      var hay = (c.headline_line1 + ' ' + c.headline_line2).toLowerCase();
      if (hay.indexOf(c.emphasis.toLowerCase().trim()) < 0) return { ok: false, reason: p + ' emphasis not in headline' };
    }
  }
  return { ok: true };
}

function buildMessages(tp) {
  tp = tp || {};
  var system = [
    'You write short banner marketing copy for Redcliffe Labs wellness creatives.',
    'For the given touchpoint, produce copy for ALL FOUR wellness pillars: diet, fitness, stress, supplements.',
    '',
    'Return ONLY a JSON object with exactly these keys: diet, fitness, stress, supplements.',
    'Each value is an object: {"headline_line1","headline_line2","emphasis","emphasis_scope","subline","relevance"}.',
    '- headline_line1 / headline_line2: the two lines of the banner headline. Each line <= 4 words AND <= 20 characters.',
    '- emphasis: the exact span of the headline rendered in magenta (must appear verbatim in the headline).',
    '- emphasis_scope: "word" (a single word/compound), "line" (a whole headline line), or "all" (the whole headline).',
    '- subline: a short supporting line under the headline. Max 2 lines, each <= 5 words. Full sentence ends with a period; a fragment does not.',
    '- relevance: "primary" if this pillar naturally fits the touchpoint, "secondary" if it loosely fits, "na" if it does not fit (e.g. a diet banner for a shipping/logistics touchpoint). Set relevance honestly.',
    '',
    'Voice: second person ("Your..."), aspirational, forward-looking, simple universal English.',
    'Prohibitions: no clinical or diagnosis claims; no discounts/urgency unless the touchpoint is transactional; no emojis; no slang, idioms, or transliteration.',
    '',
    'Gold examples (match this register and structure):',
    '1. Diet: {"headline_line1":"Your Personalised","headline_line2":"Nutrition Journey","emphasis":"Your Personalised Nutrition Journey","emphasis_scope":"all","subline":"For Better Health\\nStarts Here.","relevance":"primary"}',
    '2. Fitness: {"headline_line1":"Your Fitness","headline_line2":"Transformation","emphasis":"Fitness","emphasis_scope":"word","subline":"Starts Here","relevance":"primary"}',
    '3. Supplements: {"headline_line1":"Personalised","headline_line2":"Supplement Guidance","emphasis":"Supplement Guidance","emphasis_scope":"line","subline":"For Your Unique Needs.","relevance":"primary"}',
    '4. Stress: {"headline_line1":"Your Stress-Free","headline_line2":"Journey","emphasis":"Stress-Free","emphasis_scope":"word","subline":"Starts Here","relevance":"primary"}'
  ].join('\n');

  var user = [
    'Touchpoint: ' + (tp.name || ''),
    'When it is sent: ' + (tp.when || ''),
    'Message body: ' + (tp.body || ''),
    'Push text: ' + (tp.push || '')
  ].join('\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { stripPII, splitEmphasis, validateGeneration, buildMessages, WCS_PILLARS };
}
