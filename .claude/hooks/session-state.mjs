// SessionStart hook (startup | clear | compact): injects branch, recent commits,
// uncommitted files and the latest handoff note, so a fresh session can continue
// without you pasting "continue from where you left off".
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sh = c => { try { return execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

const candidates = ['docs/HANDOFF.md', 'docs/STATE_OF_THE_UNION.md'];
const found = candidates.find(f => fs.existsSync(path.join(cwd, f)));
const handoff = found
  ? `(${found})\n` + fs.readFileSync(path.join(cwd, found), 'utf8').slice(0, 10000)
  : '(no docs/HANDOFF.md yet; run /handoff before /clear to create one)';

const ctx = [
  '## Session state (auto-injected by .claude/hooks/session-state.mjs)',
  `Branch: ${sh('git branch --show-current') || '?'}`,
  'Last commits:', sh('git log --oneline -5') || '(none)',
  'Uncommitted:', sh('git status --short') || '(clean)',
  '',
  '## Handoff from the previous session', handoff,
].join('\n');

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } }));
