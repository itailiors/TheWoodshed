// PreToolUse hook (Bash | PowerShell): stops shell commands that send a write request to
// the local API on :8787, which writes to Itai's REAL practice database
// (apps/api/data/reharm.sqlite). Exit 2 blocks the call and sends stderr back to Claude.
// A command that visibly sets REHARM_DB to a throwaway database is allowed, so tests
// against a scratch copy still work. GETs are always allowed. Dependency-free; see
// guard-real-db.test.mjs (run: node --test .claude/hooks/guard-real-db.test.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// localhost:8787, 127.0.0.1:8787, [::1]:8787, 0.0.0.0:8787, or a { port: 8787 } option.
const TARGET = /(?:\blocalhost|\b127\.0\.0\.1|\[::1\]|\b0\.0\.0\.0)\s*:\s*8787(?!\d)|\bport\s*[:=]\s*['"]?8787(?!\d)/i;

const VERB = '(?:POST|PUT|PATCH|DELETE)';
const MUTATING = [
  new RegExp(`(?:^|\\s)(?:-X\\s*|--request[\\s=]+)['"]?${VERB}\\b`, 'i'),        // curl -X POST, --request=PATCH
  new RegExp(`-Method[\\s:]+['"]?(?!(?:GET|HEAD|OPTIONS)\\b)[\\w$]`, 'i'),         // Invoke-RestMethod -Method Post (anything but GET/HEAD/OPTIONS)
  new RegExp(`\\bmethod\\s*[:=]\\s*['"\`]?${VERB}\\b`, 'i'),                       // fetch(url, { method: "POST" }), Request(method="PUT")
  new RegExp(`\\.(?:post|put|patch|delete)\\s*\\(`, 'i'),                          // requests.post(, axios.delete(, httpx.patch(
  /\bsendBeacon\s*\(/,                                                              // navigator.sendBeacon(...)
  /--(?:post-data|post-file|method)\b/i,                                            // wget --post-data / --method=PUT
  new RegExp(`\\b${VERB}\\b`),                                                      // any bare upper-case verb: http POST ..., -X POST
];
// curl flags that send a body (curl then defaults to POST): -d, -F, -T (also bundled, e.g. -sd), --data*, --form*, --json, --upload-file
const CURL_BODY = /(?:^|\s)(?:-[a-zA-Z]*[dFT](?=[\s'"@{=]|$)|--(?:data(?:-raw|-binary|-urlencode|-ascii)?|form(?:-string)?|json|upload-file)\b)/;

// REHARM_DB=<x> (bash / env / export / cmd set) or $env:REHARM_DB = <x> (PowerShell)
const DB_ASSIGN = /(?:\$env:)?\bREHARM_DB\s*=\s*("[^"]*"|'[^']*'|[^\s;&|]+)/gi;
const REAL_DB = /apps[\\/]+api[\\/]+data(?:[\\/]|$)|(?:^|[\\/])data[\\/]+reharm\.sqlite$/i;

export function usesThrowawayDb(cmd) {
  for (const m of cmd.matchAll(DB_ASSIGN)) {
    const value = m[1].replace(/^["']|["']$/g, '').trim();
    // A bare variable ($X, ${X}) doesn't show which file it is; a path like $TMP/x.sqlite does.
    if (value && !/^\$\{?\w+\}?$/.test(value) && !REAL_DB.test(value)) return true;
  }
  return false;
}

export function isMutating(cmd) {
  if (MUTATING.some(re => re.test(cmd))) return true;
  return /\bcurl(?:\.exe)?\b/i.test(cmd) && CURL_BODY.test(cmd);
}

/** @returns {{ block: boolean, reason?: string }} */
export function decide(toolName, command) {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return { block: false };
  if (typeof command !== 'string' || !TARGET.test(command)) return { block: false };
  if (!isMutating(command)) return { block: false };
  if (usesThrowawayDb(command)) return { block: false };
  return { block: true, reason: MESSAGE };
}

const MESSAGE = `Blocked by .claude/hooks/guard-real-db.mjs: this command sends a write request (POST/PUT/PATCH/DELETE or a request body) to the local API on :8787, which writes to Itai's REAL practice database (apps/api/data/reharm.sqlite).
Do this instead:
- Read-only checks are fine: plain GETs, e.g. curl -s localhost:8787/api/practice/progress
- To test writes, use a scratch copy: sha256sum the real DB, copy it to the scratchpad, then start a temporary API on it, preferably on another port: from apps/api run  PORT=8788 REHARM_DB=<scratch copy> npx tsx src/index.ts  and send your requests to :8788. Re-check the checksum afterwards.
- If the temporary scratch-DB API really is the one on :8787 (the api preview stopped, see CLAUDE.md "Protect Itai's data"), put REHARM_DB=<scratch copy> in this same command to declare it.
- Or test in Study mode / the static demo build (npm run build:demo), which never writes.`;

async function main() {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  try {
    const ev = JSON.parse(raw || '{}');
    const verdict = decide(ev.tool_name, ev.tool_input?.command);
    if (verdict.block) {
      process.stderr.write(verdict.reason + '\n');
      process.exit(2);
    }
    process.exit(0);
  } catch {
    // Unparseable input: fail open, unless the raw text clearly targets :8787 with a write.
    if (TARGET.test(raw) && isMutating(raw) && !usesThrowawayDb(raw)) {
      process.stderr.write(MESSAGE + '\n');
      process.exit(2);
    }
    process.exit(0);
  }
}

// Run only when executed as the hook, not when imported by the test.
const norm = p => path.resolve(p).toLowerCase();
if (process.argv[1] && norm(fileURLToPath(import.meta.url)) === norm(process.argv[1])) await main();
