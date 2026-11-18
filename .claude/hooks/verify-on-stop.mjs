// Stop hook: before Claude finishes a turn, run the project's check if relevant files changed.
// On failure, exit 2 sends the errors back to Claude so it keeps working instead of saying "done".
// Usage: node verify-on-stop.mjs <path-prefix|.> <ext,ext,...> <command...>
//   e.g. node verify-on-stop.mjs app/ ts,tsx "cd app && npm run typecheck && npm run lint"
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let raw = '';
for await (const c of process.stdin) raw += c;
let ev = {};
try { ev = JSON.parse(raw || '{}'); } catch {}
if (ev.stop_hook_active) process.exit(0); // already fixing after a failed check: don't loop

const [prefixArg = '.', extsArg = 'ts,tsx', ...cmdParts] = process.argv.slice(2);
const cmd = cmdParts.join(' ') || 'npm run typecheck';
const prefix = prefixArg === '.' ? '' : prefixArg.replace(/\\/g, '/');
const exts = extsArg.split(',').map(e => '.' + e.replace(/^\./, '').toLowerCase());
const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = a => { try { return execSync(`git ${a}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return ''; } };

// Changed or untracked files under the prefix with a matching extension
const changed = git('status --porcelain -uall').split('\n')
  .map(l => l.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''))
  .filter(f => f && f.startsWith(prefix) && exts.includes(path.extname(f).toLowerCase()));
if (!changed.length) process.exit(0);

// Skip if nothing changed since the last passing run (keeps chat-only turns fast)
const fingerprint = crypto.createHash('sha1').update(cmd + git(`diff HEAD -- ${prefix || '.'}`) + changed.join('|')).digest('hex');
const stamp = path.join(os.tmpdir(), 'claude-verify-' + crypto.createHash('sha1').update(cwd + cmd).digest('hex').slice(0, 12));
try { if (fs.readFileSync(stamp, 'utf8') === fingerprint) process.exit(0); } catch {}

try {
  execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 170000 });
  fs.writeFileSync(stamp, fingerprint);
  process.exit(0);
} catch (e) {
  const out = `${e.stdout || ''}\n${e.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
  process.stderr.write(`Verification failed: \`${cmd}\`\nFix these before finishing (or say why they're unrelated):\n${out}\n`);
  process.exit(2);
}
