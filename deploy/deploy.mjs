// Deploys the app to Cloud Run. Run from the repo root:  node deploy/deploy.mjs [--project id] [--region r] [--stage-only]
// Builds the app, copies the avatar pack in from private/ (it is never committed), and sends the lot to Cloud Run.
// --stage-only stops after assembling deploy/out/ so you can look at it or run it locally.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, parseFlags, resolveProject, run } from './gcloud.mjs';

const flags = parseFlags(process.argv.slice(2));
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const region = flags.region ?? DEFAULTS.region;
const service = flags.service ?? DEFAULTS.service;
const secret = flags.secret ?? DEFAULTS.secret;
const user = flags.user ?? DEFAULTS.user;

// The same four files the viewer loads (app/src/viewer.ts).
const PACK = ['body', 'tee', 'tee_v', 'tee_scoop', 'trousers', 'sweatshirt'];
const packDir = here('../private/pack/joe/');
const missing = PACK.filter((n) => !existsSync(packDir + n + '.glb'));
if (missing.length) {
  console.error(`Avatar pack not found in private/pack/joe/ (${missing.join(', ')}). Run: python pack/build_pack.py --private`);
  process.exit(1);
}

console.log('1/3 Building the app');
if (run('npm', ['--prefix', 'app', 'run', 'build']).status !== 0) process.exit(1);

console.log('2/3 Assembling deploy/out/');
const out = here('./out');
rmSync(out, { recursive: true, force: true });
mkdirSync(out + '/public/pack/joe', { recursive: true });
cpSync(here('./server.mjs'), out + '/server.mjs');
cpSync(here('./Dockerfile'), out + '/Dockerfile');
cpSync(here('../app/dist'), out + '/public', { recursive: true });
for (const n of PACK) cpSync(packDir + n + '.glb', `${out}/public/pack/joe/${n}.glb`);
if (flags['stage-only']) {
  console.log('Staged in deploy/out/. Stopping because of --stage-only.');
  process.exit(0);
}

const project = resolveProject(flags);
console.log(`3/3 Deploying ${service} to ${project} (${region})`);
const r = run('gcloud', [
  'run', 'deploy', service,
  '--source', out,
  '--project', project,
  '--region', region,
  // Cloud Run's own login is off because the server asks for the basic-auth password itself.
  '--allow-unauthenticated',
  '--max-instances', '1',
  '--memory', '256Mi',
  `--set-env-vars=BASIC_AUTH_USER=${user}`,
  `--set-secrets=BASIC_AUTH_PASSWORD=${secret}:latest`,
  '--quiet',
]);
process.exit(r.status);
