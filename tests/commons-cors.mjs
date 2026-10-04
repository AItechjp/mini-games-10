import assert from 'node:assert/strict';
import { commonsCors, endpointOrigins } from '../supabase/functions/_shared/commons-cors.mjs';
import { PUBLIC_KEY } from '../supabase/functions/commons-search/public-key.mjs';

// Capture Deno registration only; importing and testing these public readers must
// never make upstream requests. Validation errors exercise the real handler path.
const previousDeno = globalThis.Deno;
const previousFetch = globalThis.fetch;
globalThis.Deno = { serve: () => {} };
globalThis.fetch = () => { throw new Error('Unexpected network request in CORS test'); };
let checks = 0;
try {
  const handlers = {
    search: (await import('../supabase/functions/commons-search/index.ts')).default.fetch,
    yugioh: (await import('../supabase/functions/commons-yugioh/index.ts')).handler,
    cards: (await import('../supabase/functions/commons-cards/index.ts')).handler,
    tcg: (await import('../supabase/functions/commons-tcg/handler.mjs')).handler,
  };
  for (const [endpoint, handler] of Object.entries(handlers)) {
    const invoke = (origin, method = 'GET', extra = {}) => handler(new Request('https://example.invalid/' + endpoint, {
      method, headers: { ...(origin === null ? {} : { Origin: origin }), ...extra },
    }));
    for (const origin of endpointOrigins[endpoint]) {
      const preflight = await invoke(origin, 'OPTIONS', {
        'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'apikey,content-type',
      });
      assert.equal(preflight.status, 204);
      assert.equal(await preflight.text(), '');
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.equal(preflight.headers.get('vary'), 'Origin');
      assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
      assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
      const unauthenticated = await invoke(origin);
      assert.equal(unauthenticated.status, 401, 'Origin approval must not bypass the existing API-key check');
      assert.equal(unauthenticated.headers.get('access-control-allow-origin'), origin);
      const invalid = await invoke(origin, 'GET', { apikey: PUBLIC_KEY });
      assert.equal(invalid.status, 400, 'Authorized request reaches validation without upstream I/O');
      assert.equal(invalid.headers.get('access-control-allow-origin'), origin);
      assert.equal((await invoke(origin, 'POST', { apikey: PUBLIC_KEY })).status, 405);
      checks += 4;
    }
    for (const origin of ['null', '', 'http://aitechd.com', 'http://tools.aitechd.com',
      'https://aitechd.com.evil.example', 'https://tools.aitechd.com.evil.example',
      'https://evilaitechd.com', 'https://unregistered.aitechd.com',
      'https://tools.aitechd.com:8443', 'https://tools.aitechd.com/',
      'https://tools.aitechd.com@evil.example', 'https://tools.aitechd.com https://evil.example']) {
      for (const method of ['GET', 'OPTIONS']) {
        const rejected = await invoke(origin, method, { apikey: PUBLIC_KEY });
        assert.equal(rejected.status, 403, endpoint + ': ' + origin);
        assert.equal(rejected.headers.get('access-control-allow-origin'), null, 'Never reflect a rejected origin');
        checks++;
      }
    }
    const noOrigin = await invoke(null, 'GET', { apikey: PUBLIC_KEY });
    assert.equal(noOrigin.status, 400, 'Preserve non-browser requests');
    assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);
    const hostile = 'https://tools.aitechd.com\r\nAccess-Control-Allow-Origin: *';
    assert.equal(commonsCors(endpoint).isAllowed(hostile), false);
    assert.equal(commonsCors(endpoint).headers(hostile)['Access-Control-Allow-Origin'], undefined);
    const preflight = await invoke(endpointOrigins[endpoint][0], 'OPTIONS', {
      'Access-Control-Request-Headers': 'x-injected-header', 'Access-Control-Request-Method': 'DELETE',
    });
    assert(!preflight.headers.get('access-control-allow-headers').includes('x-injected-header'));
    assert(!preflight.headers.get('access-control-allow-methods').includes('DELETE'));
    checks += 3;
  }
  assert.throws(() => commonsCors('__proto__'));
  assert.equal(commonsCors('cards').isAllowed('https://hotels.aitechd.com'), false);
  console.log(JSON.stringify({ passed: true, checks, endpoints: 4, networkRequests: 0 }));
} finally {
  globalThis.Deno = previousDeno;
  globalThis.fetch = previousFetch;
}
