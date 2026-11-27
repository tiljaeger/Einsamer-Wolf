import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

// Generate exactly the worker used in production against a tiny local build fixture.
// Neither the fixture nor the event simulation makes a network request.
async function generatedWorkers() {
  const dir = await mkdtemp(join(tmpdir(), 'einsamer-pwa-test-'));
  try {
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, 'dist', 'assets'), { recursive: true });
    await copyFile(new URL('../scripts/generate-sw.mjs', import.meta.url), join(dir, 'scripts', 'generate-sw.mjs'));
    await writeFile(join(dir, 'dist', 'index.html'), '<title>Einsamer Wolf</title>');
    await writeFile(join(dir, 'dist', 'assets', 'app.js'), 'version one');
    await writeFile(join(dir, 'dist', 'assets', 'style.css'), 'body{}');
    let generation = 0;
    const generate = async () => {
      const url = pathToFileURL(join(dir, 'scripts', 'generate-sw.mjs'));
      url.searchParams.set('generation', String(generation++));
      await import(url.href);
      return readFile(join(dir, 'dist', 'sw.js'), 'utf8');
    };
    const first = await generate();
    await writeFile(join(dir, 'dist', 'assets', 'app.js'), 'version two');
    const second = await generate();
    return { first, second };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type RequestLike = { url: string; method: string; mode: string; cache?: string };
const origin = 'https://wolf.example';

function simulation(source: string, shared?: Map<string, Map<string, string>>, missing?: string, offline = false) {
  const handlers = new Map<string, (event: never) => void>();
  const stores = shared ?? new Map<string, Map<string, string>>();
  const fetches: string[] = [];
  const updates: string[] = [];
  const resources = new Map([
    ['/', 'startseite'], ['/index.html', 'startseite'], ['/assets/app.js', 'javascript'], ['/assets/style.css', 'css'],
  ]);
  if (missing) resources.delete(missing);
  const normalize = (v: string | RequestLike) => new URL(typeof v === 'string' ? v : v.url, origin).pathname;
  class FakeRequest {
    url: string;
    method = 'GET';
    mode = 'same-origin';
    cache?: string;
    constructor(url: string, options?: { cache?: string }) {
      this.url = new URL(url, origin).href;
      this.cache = options?.cache;
    }
  }
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name)!;
      return {
        async addAll(requests: RequestLike[]) {
          // A failed precache installation rejects instead of leaving a partial cache.
          const assets = requests.map(request => {
            assert.equal(request.cache, 'reload');
            const path = normalize(request);
            const value = resources.get(path);
            if (value === undefined) throw new Error(`Missing fixture: ${path}`);
            return [path, value] as const;
          });
          for (const [path, value] of assets) values.set(path, value);
        },
        async match(request: string | RequestLike) { return values.get(normalize(request)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name: string) { return stores.delete(name); },
  };
  const self = {
    location: { origin },
    async skipWaiting() { updates.push('skipWaiting'); },
    clients: { async claim() { updates.push('claim'); } },
    addEventListener(type: string, handler: (event: never) => void) { handlers.set(type, handler); },
  };
  const fetch = async (request: RequestLike, options?: { cache: string }) => {
    fetches.push(request.url);
    if (request.mode === 'navigate') assert.equal(options?.cache, 'no-cache');
    if (offline) throw new TypeError('offline');
    return 'net:' + request.url;
  };
  runInNewContext(source, { self, caches, fetch, Request: FakeRequest, URL, Promise });
  async function lifecycle(type: string) {
    let pending: Promise<unknown> | undefined;
    const event = { waitUntil(promise: Promise<unknown>) { pending = promise; } };
    handlers.get(type)!(event as never);
    assert.ok(pending, `${type} must use waitUntil`);
    await pending;
  }
  async function request(path: string, method = 'GET', mode = 'same-origin') {
    let response: Promise<unknown> | undefined;
    const event = {
      request: { url: new URL(path, origin).href, method, mode },
      respondWith(promise: Promise<unknown>) { response = promise; },
    };
    handlers.get('fetch')!(event as never);
    return response ? { handled: true, value: await response } : { handled: false };
  }
  return { stores, fetches, updates, lifecycle, request };
}

test('installation precaches the app shell and serves navigations and assets offline', async () => {
  const { first } = await generatedWorkers();
  const sw = simulation(first, undefined, undefined, true);
  await sw.lifecycle('install');
  const cache = [...sw.stores.values()][0];
  assert.deepEqual([...cache.keys()].sort(), ['/', '/assets/app.js', '/assets/style.css', '/index.html']);
  assert.deepEqual(await sw.request('/character', 'GET', 'navigate'), { handled: true, value: 'startseite' });
  assert.deepEqual(await sw.request('/assets/app.js?rev=1'), { handled: true, value: 'javascript' });
  assert.deepEqual(await sw.request('/assets/style.css'), { handled: true, value: 'css' });
  assert.deepEqual(sw.fetches, [origin + '/character']);
});

test('online navigation checks the server even when an old app shell is cached', async () => {
  const { first } = await generatedWorkers();
  const sw = simulation(first);
  await sw.lifecycle('install');
  assert.deepEqual(await sw.request('/', 'GET', 'navigate'), { handled: true, value: 'net:' + origin + '/' });
  assert.deepEqual(await sw.request('/assets/app.js'), { handled: true, value: 'javascript' });
});

test('worker ignores third-party requests, non-GET methods and unknown assets', async () => {
  const { first } = await generatedWorkers();
  const sw = simulation(first);
  await sw.lifecycle('install');
  assert.deepEqual(await sw.request('https://other.example/assets/app.js'), { handled: false });
  assert.deepEqual(await sw.request('/', 'POST', 'navigate'), { handled: false });
  assert.deepEqual(await sw.request('/unknown.png'), { handled: false });
  assert.deepEqual(sw.fetches, []);
});

test('a changed build has a new cache and activation removes only old app caches', async () => {
  const { first, second } = await generatedWorkers();
  const oldWorker = simulation(first, undefined, undefined, true);
  await oldWorker.lifecycle('install');
  const [oldCache] = oldWorker.stores.keys();
  oldWorker.stores.set('another-application-cache', new Map());
  const newWorker = simulation(second, oldWorker.stores, undefined, true);
  await newWorker.lifecycle('install');
  const appCaches = [...newWorker.stores.keys()].filter(key => key.startsWith('einsamer-wolf-shell-'));
  assert.equal(appCaches.length, 2, 'changed source must create a new cache');
  assert.deepEqual(newWorker.updates, ['skipWaiting']);
  await newWorker.lifecycle('activate');
  assert.deepEqual(newWorker.updates, ['skipWaiting', 'claim']);
  assert.equal(newWorker.stores.has(oldCache), false);
  assert.equal(newWorker.stores.has('another-application-cache'), true);
  assert.equal([...newWorker.stores.keys()].filter(key => key.startsWith('einsamer-wolf-shell-')).length, 1);
  assert.deepEqual(await newWorker.request('/', 'GET', 'navigate'), { handled: true, value: 'startseite' });
});

test('cache miss falls back to fetch and does not cache unexpected network data', async () => {
  const { first } = await generatedWorkers();
  const sw = simulation(first);
  // Deliberately do not install: the cache will be empty.
  assert.deepEqual(await sw.request('/', 'GET', 'navigate'), { handled: true, value: `net:${origin}/` });
  assert.deepEqual(await sw.request('/assets/app.js'), { handled: true, value: `net:${origin}/assets/app.js` });
  assert.deepEqual(sw.fetches, [`${origin}/`, `${origin}/assets/app.js`]);
  assert.equal([...sw.stores.values()][0].size, 0);
});


test('incomplete downloads reject installation without replacing the old cache', async () => {
  const { first, second } = await generatedWorkers();
  const oldWorker = simulation(first, undefined, undefined, true);
  await oldWorker.lifecycle('install');
  const [oldCache] = oldWorker.stores.keys();
  const newWorker = simulation(second, oldWorker.stores, '/assets/app.js');
  await assert.rejects(newWorker.lifecycle('install'), /Missing fixture/);
  assert.deepEqual(newWorker.updates, [], 'an incomplete update must not replace the active worker');
  assert.equal(oldWorker.stores.has(oldCache), true);
  assert.deepEqual(await oldWorker.request('/', 'GET', 'navigate'), { handled: true, value: 'startseite' });
});
