import { relative, dirname } from 'node:path';

export function addFullscreen(html, file, root) {
  const name = relative(root, file).replaceAll('\\', '/');
  if (['index.html', 'legal.html', 'ninja-admax-frame.html'].includes(name)) return html;
  if (!/<body\b/i.test(html) || /http-equiv=["']refresh/i.test(html)) return html;
  if (html.includes('data-aitech-fullscreen')) return html;
  const src = relative(dirname(file), `${root}/fullscreen.js`).replaceAll('\\', '/');
  return html.replace(/<\/head>/i, `<script src="${src}" defer data-aitech-fullscreen></script>\n</head>`);
}
