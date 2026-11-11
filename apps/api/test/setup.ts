import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Point the *default* database path at a throwaway sentinel before any app code loads,
 * so no test can ever write to the developer's real apps/api/data/reharm.sqlite.
 * api.test.ts asserts the sentinel stays untouched.
 */
const dir = mkdtempSync(path.join(tmpdir(), "reharm-sentinel-"));
process.env.REHARM_DB = path.join(dir, "must-not-exist.sqlite");
