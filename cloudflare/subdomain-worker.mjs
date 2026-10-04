// Wrangler bundles the private registry; build-static.mjs excludes docs/cloudflare.
import registry from '../docs/subdomains.json' with { type: 'json' };
import { createRootRouter } from './subdomain-router.mjs';

const routeRoot = createRootRouter(registry);

export default {
  fetch(request, env) {
    const redirect = routeRoot(request);
    if (redirect) return redirect;
    const url = new URL(request.url);
    const knownStatic = Object.hasOwn(registry.hosts, url.hostname) && registry.hosts[url.hostname].delivery === 'static';
    // Keep browser-visible directory paths and .html filenames exactly as the
    // existing clients expect. With html_handling=none, index lookup is explicit.
    if (knownStatic && ['GET', 'HEAD'].includes(request.method) && url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname += 'index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
