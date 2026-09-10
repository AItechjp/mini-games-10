import { promises as fs } from 'node:fs';
import path from 'node:path';

// Run against the publish directory (or the working tree for existing callers).
const root = path.resolve(process.argv[2] || process.cwd());
const VERSION = '20260911-https-v2';
const skipDirs = new Set(['.git', '.github', 'node_modules', 'tests', 'supabase', 'tools', 'scripts', 'test-output', 'test-results', 'playwright-report', '_site', 'vendor']);
const skipFiles = new Set(['https-hardening.mjs']);
const webExts = new Set(['.html', '.htm', '.css', '.js', '.mjs']);
const namespaces = [
  'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink', 'http://www.w3.org/1998/Math/MathML'
];
const transport = /\b(?:http|ws):\/\/[^\s"'`<>)}\]]+/gi;
const isLocal = url => /^(?:http|ws):\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(url);
const isNamespace = url => namespaces.includes(url);
function upgrade(text) {
  // Namespace identifiers are identifiers, not network requests: never rewrite them.
  return text.replace(transport, url => isLocal(url) || isNamespace(url) ? url : url.replace(/^http:/i, 'https:').replace(/^ws:/i, 'wss:'));
}
function hardenHtml(html) {
  html = upgrade(html);
  html = html.replace(/<script\b[^>]*\bsrc=["'](?:https?:)?\/\/(?:adm\.shinobi\.jp|pagead2\.googlesyndication\.com)\/[^"']*["'][^>]*>\s*<\/script>/gi, '');
  const match = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html);
  if (!match) throw new Error('HTML document has no explicit head; cannot safely install HTTPS policy');
  let head = match[1];
  // Replace only our old policy, preserving all independently authored CSP rules.
  head = head.replace(/<meta\b[^>]*>/gi, tag => {
    if (/\bid=["']site-https-policy["']/i.test(tag) || /\bname=["']site-security-version["']/i.test(tag)) return '';
    if (/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag) && /content\s*=\s*["']upgrade-insecure-requests;\s*block-all-mixed-content["']/i.test(tag)) return '';
    return tag;
  });
  // Server-side Enforce HTTPS is verified separately. Do not rely on a late JS redirect.
  head = head.replace(/<script\b[^>]*\bid=["']https-only-bootstrap["'][^>]*>[\s\S]*?<\/script\s*>/gi, '');
  const charset = head.match(/<meta\b[^>]*\bcharset\s*=\s*[^>]+>/i)?.[0] || '<meta charset="utf-8">';
  head = head.replace(charset, '').trim();
  const prefix = `${charset}\n<meta id="site-https-policy" http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">\n<meta name="site-security-version" content="${VERSION}">`;
  const opening = match[0].slice(0, match[0].indexOf('>') + 1);
  const replacement = `${opening}\n${prefix}\n${head}\n</head>`;
  return html.slice(0, match.index) + replacement + html.slice(match.index + match[0].length);
}
async function walk(dir) {
  const files = [];
  for (const entry of (await fs.readdir(dir, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) files.push(...await walk(full)); }
    else if (webExts.has(path.extname(entry.name).toLowerCase()) && !skipFiles.has(entry.name)) files.push(full);
  }
  return files;
}
const files = await walk(root);
const pages = [];
let changed = 0;
for (const file of files) {
  const relative = path.relative(root,file).split(path.sep).join('/');
  const before = await fs.readFile(file,'utf8');
  const isHtml = /\.html?$/i.test(file);
  let after;
  try { after = isHtml ? hardenHtml(before) : upgrade(before); }
  catch(error) { throw new Error(`${relative}: ${error.message}`); }
  const unsafe = [...after.matchAll(transport)].map(m=>m[0]).filter(url=>!isLocal(url)&&!isNamespace(url));
  if (unsafe.length) throw new Error(`${relative}: insecure references remain: ${unsafe.join(', ')}`);
  if (isHtml) pages.push(relative);
  if (after !== before) { await fs.writeFile(file,after); changed++; console.log(`HTTPS hardened: ${relative}`); }
}
if (!pages.includes('index.html')) throw new Error('No index.html in publish directory');
const manifest = {version:VERSION,commit:process.env.GITHUB_SHA || null,pages:pages.sort(),assetsChecked:files.length};
await fs.writeFile(path.join(root,'https-release.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`HTTPS hardening complete: ${files.length} owned web assets, ${pages.length} HTML documents, ${changed} updated.`);
