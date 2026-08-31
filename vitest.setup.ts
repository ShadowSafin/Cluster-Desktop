import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Tests must never touch the real ~/.cluster directory.
 * This runs before every test file, so the logger and session store resolve to
 * a throwaway directory for the duration of the run.
 */
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-test-'));
process.env.CLUSTER_HOME = home;
process.env.CLUSTER_LOG_LEVEL = 'silent';
