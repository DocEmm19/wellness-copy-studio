#!/usr/bin/env node
// Validate script(s) against the attention playbook without rendering.
//   node video/check.js video/scripts/*.json
const fs = require('fs');
const { validateScript, estimateDuration } = require('./video-lib');

let ok = true;
for (const f of process.argv.slice(2)) {
  let s;
  try { s = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`✗ ${f}: ${e.message}`); ok = false; continue; }
  const v = validateScript(s);
  if (v.ok) console.log(`✓ ${f} (~${estimateDuration(s).toFixed(1)}s, ${s.scenes.length} scenes, hook: ${s.hook_type})`);
  else { ok = false; console.error(`✗ ${f}\n  - ` + v.errors.join('\n  - ')); }
}
process.exit(ok ? 0 : 1);
