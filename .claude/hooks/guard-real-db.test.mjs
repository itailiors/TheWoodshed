// Tests for guard-real-db.mjs. Run: node --test .claude/hooks/guard-real-db.test.mjs
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { decide } from './guard-real-db.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-real-db.mjs');

const BLOCKED = [
  ['Bash', 'curl -X POST http://localhost:8787/api/practice/sessions'],
  ['Bash', `curl -s -XPOST localhost:8787/api/practice/improv-runs -H "content-type: application/json" -d '{}'`],
  ['Bash', `curl -d '{"tuneId":"x"}' http://127.0.0.1:8787/api/practice/coach-attempts`],
  ['Bash', 'curl -sd @run.json localhost:8787/api/practice/improv-runs'],
  ['Bash', `curl --json '{"a":1}' http://[::1]:8787/api/practice/sessions`],
  ['Bash', 'curl -F file=@tune.txt http://localhost:8787/api/import/ireal'],
  ['Bash', 'curl --request DELETE http://localhost:8787/api/tunes/abc'],
  ['Bash', 'curl -X delete localhost:8787/api/tunes/abc'],
  ['PowerShell', "Invoke-RestMethod -Uri http://localhost:8787/api/practice/sessions -Method Post -Body '{}' -ContentType application/json"],
  ['PowerShell', 'iwr http://127.0.0.1:8787/api/tunes/abc -Method Delete'],
  ['Bash', `node -e "fetch('http://localhost:8787/api/practice/sessions',{method:'POST',body:'{}'})"`],
  ['Bash', `uv run --no-project python -c "import requests; requests.post('http://localhost:8787/api/practice/sessions', json={})"`],
  ['Bash', 'http POST localhost:8787/api/practice/sessions tuneId=x'],
  ['Bash', 'REHARM_DB=apps/api/data/reharm.sqlite curl -X POST localhost:8787/api/practice/sessions'],
  ['Bash', 'REHARM_DB=$DB curl -X POST localhost:8787/api/practice/sessions'],
];

const ALLOWED = [
  ['Bash', 'curl -s localhost:8787/api/practice/progress'],
  ['Bash', 'curl -s http://127.0.0.1:8787/api/health | head'],
  ['Bash', 'curl -X GET http://localhost:8787/api/tunes'],
  ['PowerShell', 'Invoke-RestMethod http://localhost:8787/api/tunes -Method Get'],
  ['Bash', 'curl -X POST http://localhost:8788/api/practice/sessions -d "{}"'],
  ['Bash', 'curl -X POST http://localhost:5173/api/practice/sessions'],
  ['Bash', 'curl -X POST https://example.com/webhook -d x'],
  ['Bash', 'REHARM_DB="C:/Users/me/scratch/reharm.sqlite" curl -X POST localhost:8787/api/practice/sessions -d "{}"'],
  ['PowerShell', "$env:REHARM_DB = 'C:\\tmp\\scratch.sqlite'; Invoke-RestMethod http://localhost:8787/api/practice/sessions -Method Post"],
  ['Bash', 'cd apps/api && REHARM_DB=/tmp/s.sqlite PORT=8787 npx tsx src/index.ts'],
  ['Bash', 'netstat -ano | grep :8787'],
  ['Bash', 'npm run typecheck && npm test'],
  ['Bash', 'git commit -m "feat: add DELETE route"'],
  ['Read', 'curl -X POST localhost:8787/api/practice/sessions'],
];

for (const [tool, cmd] of BLOCKED) {
  test(`blocks [${tool}] ${cmd}`, () => assert.equal(decide(tool, cmd).block, true));
}
for (const [tool, cmd] of ALLOWED) {
  test(`allows [${tool}] ${cmd}`, () => assert.equal(decide(tool, cmd).block, false));
}

const run = input => spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });

test('hook process exits 2 with guidance on a POST to :8787', () => {
  const r = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'curl -X POST localhost:8787/api/practice/sessions' } }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REAL practice database/);
  assert.match(r.stderr, /REHARM_DB/);
});

test('hook process exits 0 on a GET and on garbage input', () => {
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'curl localhost:8787/api/tunes' } })).status, 0);
  assert.equal(run('not json').status, 0);
  assert.equal(run('').status, 0);
});

test('hook process blocks unparseable input that clearly POSTs to :8787', () => {
  assert.equal(run('{broken curl -X POST localhost:8787/api/tunes').status, 2);
});
