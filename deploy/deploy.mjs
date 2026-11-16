// Deploys the app to Cloud Run behind Identity-Aware Proxy. Run from the repo root:
//   node deploy/deploy.mjs [--project id] [--region r] [--service s] [--users file] [--stage-only]
// Builds the app, copies each person's avatar pack in from private/pack/<person>/ (never committed),
// sends the lot to Cloud Run with IAP on, and lets in only the people in private/users.json.
// --stage-only stops after assembling deploy/out/ so you can look at it or run it locally.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, gcloudValue, parseFlags, resolveProject, run } from './gcloud.mjs';
import { parseAllowedUsers } from './server.mjs';
import { setUpFirestore } from './firestore-setup.mjs';

const flags = parseFlags(process.argv.slice(2));
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const region = flags.region ?? DEFAULTS.region;
const service = flags.service ?? DEFAULTS.service;

// Who may sign in: { "joe": "joe's Google email", "b": "B's Google email" }. Kept in private/ so the emails stay out of the repo.
const usersFile = flags.users ? resolve(flags.users) : here('../private/users.json');
if (!existsSync(usersFile)) {
  console.error('private/users.json not found. Copy deploy/users.example.json there and put in the two Google email addresses.');
  process.exit(1);
}
const usersJson = readFileSync(usersFile, 'utf8');
let people;
try {
  people = [...new Set(parseAllowedUsers(usersJson).values())];
} catch (e) {
  console.error(`private/users.json: ${e.message}`);
  process.exit(1);
}
const emails = Object.values(JSON.parse(usersJson));

// The files the viewer loads (keep in step with PACK_FILES in app/vite.config.ts and app/src/viewer.ts).
const PACK = ['body', 'tee', 'tee_v', 'tee_scoop', 'trousers', 'shorts', 'tights', 'sweatshirt'];
for (const person of people) {
  const missing = PACK.filter((n) => !existsSync(here(`../private/pack/${person}/${n}.glb`)));
  if (missing.length) {
    console.error(`Avatar pack not found in private/pack/${person}/ (${missing.join(', ')}). Run: python pack/build_pack.py --private`);
    process.exit(1);
  }
}

console.log('1/4 Building the app');
if (run('npm', ['--prefix', 'app', 'run', 'build']).status !== 0) process.exit(1);

console.log('2/4 Assembling deploy/out/');
const out = here('./out');
rmSync(out, { recursive: true, force: true });
mkdirSync(out + '/public', { recursive: true });
cpSync(here('./server.mjs'), out + '/server.mjs');
cpSync(here('./datastore.mjs'), out + '/datastore.mjs');
cpSync(here('./Dockerfile'), out + '/Dockerfile');
cpSync(here('../app/dist'), out + '/public', { recursive: true });
for (const person of people) {
  mkdirSync(`${out}/public/pack/${person}`, { recursive: true });
  for (const n of PACK) cpSync(here(`../private/pack/${person}/${n}.glb`), `${out}/public/pack/${person}/${n}.glb`);
}
// The env file and IAP settings are not part of the image; .gcloudignore keeps them out of the upload.
writeFileSync(out + '/.gcloudignore', 'env.yaml\niap-settings.yaml\n.gcloudignore\n');
if (flags['stage-only']) {
  console.log('Staged in deploy/out/. Stopping because of --stage-only.');
  process.exit(0);
}

const project = resolveProject(flags);
const described = gcloudValue(['projects', 'describe', project, '--format=json']);
const projectNumber = described && JSON.parse(described).projectNumber;
if (!projectNumber) {
  console.error(`Could not read the project number for ${project}.`);
  process.exit(1);
}
const audience = `/projects/${projectNumber}/locations/${region}/services/${service}`;
// YAML accepts JSON strings, which keeps the quoting safe. A file avoids passing commas and emails through the Windows shell.
writeFileSync(out + '/env.yaml', `IAP_AUDIENCE: ${JSON.stringify(audience)}\nALLOWED_USERS: ${JSON.stringify(usersJson.trim().replace(/\s+/g, ' '))}\nFIRESTORE_PROJECT: ${JSON.stringify(project)}\n`);

const g = (args) => run('gcloud', [...args, '--project', project, '--quiet']);
const must = (r, what) => {
  if (r.status !== 0) {
    console.error(`Failed: ${what}`);
    process.exit(r.status || 1);
  }
};

console.log('3/4 Firestore for synced data (V2-06b)');
const runAccount = await setUpFirestore({ project, region });

console.log(`3/4 Deploying ${service} to ${project} (${region}) with IAP on`);
// IAP itself, and Cloud Resource Manager, which `gcloud iap web add-iam-policy-binding` needs.
must(g(['services', 'enable', 'iap.googleapis.com', 'cloudresourcemanager.googleapis.com']), 'enable the IAP and Cloud Resource Manager APIs');
must(g([
  'run', 'deploy', service,
  '--source', out,
  '--region', region,
  // Cloud Run's own access check is on, and IAP signs people in in front of it.
  '--no-allow-unauthenticated',
  '--iap',
  '--max-instances', '1',
  '--memory', '256Mi',
  '--env-vars-file', out + '/env.yaml',
  // Its own account, which can only read and write Firestore (firestore-setup.mjs).
  '--service-account', runAccount,
  // Drops the old basic-auth password (MVP-10).
  '--clear-secrets',
]), 'deploy (the first time IAP is turned on needs the one-off Console step in deploy/README.md)');

console.log('4/4 Access: IAP may call the service, and only the people in private/users.json may sign in');
must(g([
  'run', 'services', 'add-iam-policy-binding', service, '--region', region,
  `--member=serviceAccount:service-${projectNumber}@gcp-sa-iap.iam.gserviceaccount.com`, '--role=roles/run.invoker',
]), 'let IAP call the service');
// The MVP deploy let everyone call the service (the password was the lock). Remove that if it is still there.
run('gcloud', ['run', 'services', 'remove-iam-policy-binding', service, '--region', region, '--member=allUsers', '--role=roles/run.invoker', '--project', project, '--quiet'], { inherit: false, quietErrors: true });
for (const email of emails) {
  must(g([
    'iap', 'web', 'add-iam-policy-binding', `--member=user:${email}`, '--role=roles/iap.httpsResourceAccessor',
    '--region', region, '--resource-type=cloud-run', `--service=${service}`,
  ]), `let ${email} sign in`);
}
// Sign in again every 30 days (decided for V2-05). Set at project level, which covers every IAP app in the project.
writeFileSync(out + '/iap-settings.yaml', 'accessSettings:\n  reauthSettings:\n    method: "LOGIN"\n    maxAge: "2592000s"\n    policyType: "MINIMUM"\n');
if (g(['iap', 'settings', 'set', out + '/iap-settings.yaml', '--resource-type=iap_web']).status !== 0) {
  console.error('Warning: could not set the 30-day sign-in period. See deploy/README.md.');
}

console.log('\nWho may sign in now (check there are exactly two users):');
g(['iap', 'web', 'get-iam-policy', '--region', region, '--resource-type=cloud-run', `--service=${service}`]);
