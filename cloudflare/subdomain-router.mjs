// Host routing is opt-in. This module has no network, deployment or DNS side effects.
const PRIVATE_PREFIXES = [
  '/onepiece-battle/', '/commons-src/', '/source/', '/src/', '/docs/',
  '/scripts/', '/tests/', '/supabase/', '/cloudflare/', '/node_modules/',
];
const PUBLIC_DOMAIN = 'aitechd.com';

export function validateRegistry(registry) {
  if (registry?.schemaVersion !== 1 || registry.domain !== PUBLIC_DOMAIN ||
      !registry.hosts || typeof registry.hosts !== 'object' || Array.isArray(registry.hosts)) {
    throw new Error('Invalid subdomain registry');
  }
  for (const [host, entry] of Object.entries(registry.hosts)) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.aitechd\.com$/.test(host) ||
        !entry || !['static', 'sites', 'reserved'].includes(entry.delivery)) {
      throw new Error(`Invalid subdomain entry: ${host}`);
    }
    if (entry.delivery !== 'static') continue;
    const value = entry.target;
    if (typeof value !== 'string' || !/^\/[A-Za-z0-9_./-]+(?:\?[^#\r\n]*)?$/.test(value) ||
        value.startsWith('//') || value.includes('\\') || value.includes('/./') || value.includes('/../')) {
      throw new Error(`Static target must be a local application path: ${host}`);
    }
    const target = new URL(value, `https://${PUBLIC_DOMAIN}`);
    if (target.origin !== `https://${PUBLIC_DOMAIN}` || target.pathname === '/' ||
        target.pathname.split('/').some(segment => segment.startsWith('.')) ||
        PRIVATE_PREFIXES.some(prefix => (target.pathname + '/').startsWith(prefix))) {
      throw new Error(`Private or unsafe static target: ${host}`);
    }
  }
  return registry;
}

export function createRootRouter(registry) {
  validateRegistry(registry);
  const routes = new Map(Object.entries(registry.hosts)
    .filter(([, entry]) => entry.delivery === 'static')
    .map(([host, entry]) => [host, entry.target]));

  return function routeRoot(request) {
    const url = new URL(request.url);
    // Never change asset URLs, existing deep links, APIs, POSTs, or unregistered hosts.
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') ||
        !['GET', 'HEAD'].includes(request.method) || url.pathname !== '/' || !routes.has(url.hostname)) {
      return null;
    }
    const target = new URL(routes.get(url.hostname), url.origin);
    // Preserve invitation/search parameters. The route's fixed app id/game/defaults
    // win over conflicting incoming keys so a named hostname cannot select another app.
    const fixedKeys = new Set(target.searchParams.keys());
    for (const [key, value] of url.searchParams) {
      if (!fixedKeys.has(key)) target.searchParams.append(key, value);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.pathname + target.search,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  };
}
