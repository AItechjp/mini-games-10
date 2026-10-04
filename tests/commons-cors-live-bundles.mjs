import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { allowedOrigins } from '../commons-src/edge/origins.ts';
import { patchCommonsLiveOrigins } from '../scripts/patch-commons-live-origins.mjs';

const [sourceRoot, outputRoot] = process.argv.slice(2);
assert(sourceRoot && outputRoot, 'Provide downloaded live bundle directory and output directory');
const hash = text => createHash('sha256').update(text).digest('hex');
let checks = 0;
for (const [slug, file] of [['commons-api', 'index.ts'], ['commons-realtime', 'index.js']]) {
  const original = await readFile(join(resolve(sourceRoot), slug, file), 'utf8');
  const patched = patchCommonsLiveOrigins(original);
  assert.throws(() => patchCommonsLiveOrigins(patched), /differs from audited snapshot/);
  assert.throws(() => patchCommonsLiveOrigins(original + original), /differs from audited snapshot/);
  let handler, queryCount = 0;
  const imports = [];
  const testCode = patched.replace(/import (\w+) from"npm:([^";]+)";/g, (_, name, specifier) => {
    assert(['postgres@3.4.7', 'opening_hours@3.14.0'].includes(specifier));
    imports.push(specifier);
    return 'var ' + name + ' = dependencyStub;';
  });
  assert(imports.includes('postgres@3.4.7'));
  vm.runInNewContext(testCode, {
    Deno: { env: { get: () => undefined }, serve: fn => { handler = fn; } },
    dependencyStub: () => () => { queryCount++; throw new Error('Unexpected database call'); },
    Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder,
    AbortSignal, crypto: webcrypto, console,
    fetch: () => { throw new Error('Unexpected network request'); },
  }, { timeout: 5000 });
  assert.equal(typeof handler, 'function');
  for (const origin of allowedOrigins) {
    const url = 'https://example.invalid/functions/v1/' + slug + '/health';
    const preflight = await handler(new Request(url, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'apikey,content-type',
    } }));
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('vary'), 'Origin');
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    const health = await handler(new Request(url, { headers: { Origin: origin } }));
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    assert.equal(health.headers.get('access-control-allow-origin'), origin);
    checks += 2;
  }
  for (const origin of ['null', 'http://tools.aitechd.com', 'https://tools.aitechd.com.evil.example',
    'https://evilaitechd.com', 'https://unregistered.aitechd.com', 'https://tools.aitechd.com:8443',
    'https://tools.aitechd.com@evil.example', 'https://tools.aitechd.com https://evil.example']) {
    const response = await handler(new Request('https://example.invalid/health', { method: 'OPTIONS', headers: { Origin: origin } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    checks++;
  }
  assert.equal(queryCount, 0);
  const directory = join(resolve(outputRoot), slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, file), patched);
  console.log(JSON.stringify({ slug, originalSha256: hash(original), patchedSha256: hash(patched), originCount: allowedOrigins.size }));
}
console.log(JSON.stringify({ passed: true, checks, networkRequests: 0, databaseQueries: 0 }));
