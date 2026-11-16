// Sets up the Firestore database that holds synced data (V2-06b). Called by deploy.mjs; safe to run on every deploy.
// 1. Turns on the Firestore and Firebase Rules APIs.
// 2. Creates the (default) database in native mode, in the app's region, if it is not there. The region cannot change later.
// 3. Deploys security rules that refuse everything. Only our server reaches Firestore, with its own service account,
//    which rules do not apply to; no browser ever talks to Firestore.
// 4. Makes a service account for the server with one role, Firestore read and write, instead of Cloud Run's default
//    account (which usually has Editor on the whole project).
// 5. Checks that a request to Firestore without credentials is refused, and stops the deploy if it is not.
import { gcloudValue, run } from './gcloud.mjs';

export const RUN_ACCOUNT = 'huedrobe-run';
const DENY_ALL = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n";

export async function setUpFirestore({ project, region }) {
  const g = (args, opts) => run('gcloud', [...args, '--project', project, '--quiet'], opts);
  const fail = (what) => {
    console.error(`Failed: ${what}`);
    process.exit(1);
  };

  if (g(['services', 'enable', 'firestore.googleapis.com', 'firebaserules.googleapis.com', 'iam.googleapis.com']).status !== 0) fail('enable the Firestore APIs');

  if (g(['firestore', 'databases', 'describe'], { inherit: false, quietErrors: true }).status !== 0) {
    console.log(`  Creating the Firestore database in ${region}`);
    if (g(['firestore', 'databases', 'create', `--location=${region}`, '--type=firestore-native']).status !== 0) fail('create the Firestore database');
  }

  // Rules, through the Firebase Rules REST API: a ruleset, then point the Firestore release at it.
  const token = gcloudValue(['auth', 'print-access-token']);
  if (!token) fail('get an access token from gcloud');
  const api = (path, method, body) =>
    fetch(`https://firebaserules.googleapis.com/v1/projects/${project}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': project },
      body: body && JSON.stringify(body),
    });
  const ruleset = await api('/rulesets', 'POST', { source: { files: [{ name: 'firestore.rules', content: DENY_ALL }] } });
  if (!ruleset.ok) fail(`create the Firestore rules (HTTP ${ruleset.status}: ${(await ruleset.text()).slice(0, 300)})`);
  const rulesetName = (await ruleset.json()).name;
  const releaseName = `projects/${project}/releases/cloud.firestore`;
  let release = await api('/releases/cloud.firestore', 'PATCH', { release: { name: releaseName, rulesetName } });
  if (release.status === 404) release = await api('/releases', 'POST', { name: releaseName, rulesetName });
  if (!release.ok) fail(`release the Firestore rules (HTTP ${release.status}: ${(await release.text()).slice(0, 300)})`);
  console.log('  Firestore rules: deny all');

  const email = `${RUN_ACCOUNT}@${project}.iam.gserviceaccount.com`;
  if (g(['iam', 'service-accounts', 'describe', email], { inherit: false, quietErrors: true }).status !== 0) {
    if (g(['iam', 'service-accounts', 'create', RUN_ACCOUNT, '--display-name=Hue-drobe-server']).status !== 0) fail('create the server service account');
  }
  if (g(['projects', 'add-iam-policy-binding', project, `--member=serviceAccount:${email}`, '--role=roles/datastore.user', '--condition=None'], { inherit: false }).status !== 0) {
    fail('give the server service account Firestore access');
  }

  // Without credentials, Firestore must refuse. Rules can take a minute to apply, so try for a little while.
  const probe = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/people/joe/kv`;
  for (let i = 0; ; i++) {
    const res = await fetch(probe);
    if (res.status === 403 || res.status === 401) break;
    if (i >= 12) fail(`Firestore answered HTTP ${res.status} to a request without credentials. Check its rules before using it.`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log('  Checked: Firestore refuses requests without credentials');
  return email;
}
