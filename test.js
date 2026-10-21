const assert = require('node:assert/strict');
const { audit, parseRows, isDomain } = require('./app.js');
const rows = parseRows('company,person,title,domain,updated_at\nAcme,Riya Shah,CTO,acme.ai,2026-09-18\nAcme,Riya Shah,,notaurl,2026-01-01');
const result = audit(rows);
assert.equal(result.rowCount, 2);
assert.ok(result.issues.some((issue) => issue.issue.includes('Company "acme"')));
assert.ok(result.issues.some((issue) => issue.issue.includes('missing a title')));
assert.equal(isDomain('acme.ai'), true);
console.log('3 tests passed');
