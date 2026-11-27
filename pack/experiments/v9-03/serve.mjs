// V9-03 harness server: node serve.mjs [port]. Serves this folder, three.js from app/node_modules and Joe's pack from private/pack/joe.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..', '..', '..');
const mounts = [['/three/', join(repo, 'app', 'node_modules', 'three')], ['/pack/', join(repo, 'private', 'pack', 'joe')], ['/', here]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' };

export function start(port = 4301) {
  const srv = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    for (const [prefix, dir] of mounts) {
      if (!url.startsWith(prefix)) continue;
      const rel = normalize(url.slice(prefix.length) || 'index.html');
      const file = join(dir, rel);
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) continue;
      res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      return createReadStream(file).pipe(res);
    }
    res.statusCode = 404;
    res.end('not found');
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = Number(process.argv[2] ?? 4301);
  await start(p);
  console.log(`http://localhost:${p}/index.html?target=tee&pattern=hstripes`);
}
