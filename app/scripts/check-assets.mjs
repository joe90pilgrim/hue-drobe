// Runs the spike's asset checks (spike/check_reports.py) on the committed synthetic reports.
// Tolerances come from spike/tolerances.json. Needs Python 3 but not Blender.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../spike/check_reports.py', import.meta.url));
const folder = fileURLToPath(new URL('../../spike/fixtures/reports', import.meta.url));
for (const py of ['python', 'py', 'python3']) {
  const r = spawnSync(py, [script, folder], { stdio: 'inherit' });
  if (!r.error) process.exit(r.status ?? 1);
}
console.error('Python 3 not found (tried python, py, python3).');
process.exit(1);
