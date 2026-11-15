// Runs the Python-side checks that need no Blender:
//  1. the spike's asset checks (spike/check_reports.py) on pack/reports: the reports build_pack.py makes from pack/fit_config.json on the
//     synthetic bodies, i.e. the garments the app ships; tolerances come from spike/tolerances.json
//  2. the avatar pack's unit tests (pack/test_fit.py, and pack/test_reports.py: reports built from the current fit config)
// Needs Python 3.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../spike/check_reports.py', import.meta.url));
const folder = fileURLToPath(new URL('../../pack/reports', import.meta.url));
const packDir = fileURLToPath(new URL('../../pack', import.meta.url));

function runPython(args) {
  for (const py of ['python', 'py', 'python3']) {
    const r = spawnSync(py, args, { stdio: 'inherit' });
    if (!r.error) return r.status ?? 1;
  }
  console.error('Python 3 not found (tried python, py, python3).');
  return 1;
}

const reports = runPython([script, folder, '--sweatshirt']);
const packTests = runPython(['-m', 'unittest', 'discover', '-s', packDir]);
process.exit(reports || packTests);
