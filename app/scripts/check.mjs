// The full local check: the same steps, in the same order, stopping at the first failure.
// Prints how long each step took and the total. Works in PowerShell and Git Bash (no bash-only syntax).
//   node scripts/check.mjs            the full check, e2e tests on the placeholder pack
//   node scripts/check.mjs --private  only the e2e tests, on Joe's and B's real packs in private/pack/ (npm run check:private)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const privatePack = process.argv.includes('--private');
const steps = privatePack
  ? [['e2e (private pack)', 'npm run test:e2e']]
  : [
      ['typecheck', 'npm run typecheck'],
      ['vitest', 'npm run test'],
      ['check:assets', 'npm run check:assets'],
      ['check:deploy', 'npm run check:deploy'],
      ['e2e', 'npm run test:e2e'],
    ];

const run = (command) =>
  new Promise((resolve) => {
    const env = privatePack ? { ...process.env, E2E_PRIVATE_PACK: '1' } : process.env;
    const child = spawn(command, { cwd, env, shell: true, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });

const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;
const timings = [];
const t0 = Date.now();
let failed = null;
for (const [name, command] of steps) {
  console.log(`\n=== ${name}: ${command}`);
  const t = Date.now();
  const code = await run(command);
  timings.push([name, Date.now() - t, code === 0]);
  if (code !== 0) {
    failed = name;
    break;
  }
}

console.log('\n=== timings');
for (const [name, ms, ok] of timings) console.log(`${name.padEnd(14)} ${secs(ms).padStart(9)}  ${ok ? 'ok' : 'FAILED'}`);
console.log(`${'total'.padEnd(14)} ${secs(Date.now() - t0).padStart(9)}  ${failed ? `stopped at ${failed}` : 'all passed'}`);
process.exit(failed ? 1 : 0);
