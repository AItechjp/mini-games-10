import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', '.github', 'node_modules', 'tests', 'supabase']);
const skipFiles = new Set(['https-hardening.mjs']);
const webExts = new Set(['.html', '.htm', '.css', '.js', '.mjs']);
const namespaceTokens = new Map([
  ['http://www.w3.org/2000/svg', '__W3C_SVG_NAMESPACE__'],
  ['http://www.w3.org/1999/xhtml', '__W3C_XHTML_NAMESPACE__'],
  ['http://www.w3.org/1999/xlink', '__W3C_XLINK_NAMESPACE__']
]);

function protectNamespaces(text) {
  for (const [value, token] of namespaceTokens) text = text.split(value).join(token);
  return text;
}

function restoreNamespaces(text) {
  for (const [value, token] of namespaceTokens) text = text.split(token).join(value);
  return text;
}

function isLocalhostUrl(url) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(url);
}

function upgradeAbsoluteTransport(text) {
  text = protectNamespaces(text);
  text = text.replace(/http:\/\/[^\s"'`<>)}\]]+/gi, match => {
    if (isLocalhostUrl(match)) return match;
    return `https://${match.slice(7)}`;
  });
  text = text.replace(/ws:\/\/[^\s"'`<>)}\]]+/gi, match => {
    if (/^ws:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(match)) return match;
    return `wss://${match.slice(5)}`;
  });
  return restoreNamespaces(text);
}

function removeDisabledThirdPartyAds(html) {
  return html
    .replace(/<script\b[^>]*\bsrc=["']https?:\/\/adm\.shinobi\.jp\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*\bsrc=["']https?:\/\/pagead2\.googlesyndication\.com\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<iframe\b[^>]*\bsrc=["']https?:\/\/adm\.shinobi\.jp\/[^"']*["'][^>]*>\s*<\/iframe>/gi, '');
}

function hardenHtml(html) {
  html = removeDisabledThirdPartyAds(html);
  html = upgradeAbsoluteTransport(html);

  if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    const hardening = [
      '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests; block-all-mixed-content">',
      '<meta name="referrer" content="strict-origin-when-cross-origin">',
      '<script id="https-only-bootstrap">(()=>{const h=location.hostname;if(location.protocol===\'http:\'&&!/^(?:localhost|127\\.0\\.0\\.1|\\[::1\\])$/i.test(h)){location.replace(\'https://\'+location.host+location.pathname+location.search+location.hash)}})();</script>'
    ].join('');
    html = html.replace(/<head(\s[^>]*)?>/i, match => `${match}${hardening}`);
  }
  return html;
}

function dangerousTransportRefs(text) {
  const protectedText = protectNamespaces(text);
  const refs = [];
  for (const match of protectedText.matchAll(/\b(?:http|ws):\/\/[^\s"'`<>)}\]]+/gi)) {
    const url = match[0];
    if (/^(?:http|ws):\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(url)) continue;
    refs.push(url);
  }
  return refs;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = (await walk(root)).filter(file => {
  if (skipFiles.has(path.basename(file))) return false;
  return webExts.has(path.extname(file).toLowerCase());
});

let changed = 0;
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const before = await fs.readFile(file, 'utf8');
  const after = ext === '.html' || ext === '.htm' ? hardenHtml(before) : upgradeAbsoluteTransport(before);
  if (after !== before) {
    await fs.writeFile(file, after, 'utf8');
    changed += 1;
    console.log(`HTTPS hardened: ${path.relative(root, file)}`);
  }
}

const failures = [];
for (const file of files) {
  const text = await fs.readFile(file, 'utf8');
  const refs = dangerousTransportRefs(text);
  if (refs.length) failures.push(`${path.relative(root, file)}: ${[...new Set(refs)].join(', ')}`);
}

if (failures.length) {
  console.error('Unsafe absolute transport references remain:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`HTTPS hardening complete. ${files.length} public web assets checked, ${changed} updated.`);
