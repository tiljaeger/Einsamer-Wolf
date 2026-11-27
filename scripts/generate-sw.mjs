import { createHash } from 'node:crypto';
import console from 'node:console';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const output = fileURLToPath(new URL('../dist/', import.meta.url));
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]));
  return paths.flat();
}
const paths = (await files(output)).filter(path => !path.endsWith(`${sep}sw.js`)).sort();
if (!paths.some(path => relative(output, path) === 'index.html')) throw new Error('Die gebaute index.html fehlt.');
const hash = createHash('sha256');
hash.update(await readFile(fileURLToPath(import.meta.url)));
for (const path of paths) { hash.update(relative(output, path)); hash.update(await readFile(path)); }
const revision = hash.digest('hex').slice(0, 16);
const assets = ['/', ...paths.map(path => `/${relative(output, path).split(sep).join('/')}`)];
const worker = `// Bei jedem Build anhand der Inhalte generiert. Keine Nutzerdaten im Cache.
const CACHE_PREFIX = 'einsamer-wolf-shell-';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(revision)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-cache' }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('/')) || Response.error();
    }));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(url.pathname)).then(response => response || fetch(request)));
  }
});
`;
await writeFile(join(output, 'sw.js'), worker);
console.log(`Offline-App erstellt: ${assets.length} Ressourcen, Version ${revision}.`);
