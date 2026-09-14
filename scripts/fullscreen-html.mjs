import { relative, dirname } from 'node:path';

export function addFullscreen(html, file, root) {
  const name = relative(root, file).replaceAll('\\', '/');
  // One viewport controller for every game in the 2D collection, including the
  // two card modes and all seven board modes served from shared pages.
  const games = {
    'quick-hop/index.html': 'quick-hop', 'startrail/index.html': 'startrail',
    'lantern-duo/index.html': 'lantern-duo', 'babanuki.html': 'babanuki',
    'trump/index.html': 'trump', 'board-games/index.html': 'board',
    'classic.html': 'classic', 'quiz-raid/index.html': 'quiz-raid',
    'cyber-quiz/index.html': 'cyber-quiz',
  };
  if (games[name] && !html.includes('data-aitech-game-viewport')) {
    const asset = relative(dirname(file), `${root}/game-viewport`).replaceAll('\\', '/');
    html = html.replace(/<html\b/i, `<html data-aitech-game="${games[name]}"`)
      .replace(/(<meta\b[^>]*name=["']viewport["'][^>]*content=["'])([^"']*)/i,
        (_, prefix, content) => prefix + (content.includes('viewport-fit=') ? content : content + ',viewport-fit=cover'))
      .replace(/<\/head>/i, `<link rel="stylesheet" href="${asset}.css?v=20260914-landscape2"><script src="${asset}.js?v=20260914-landscape2" defer data-aitech-game-viewport></script>\n</head>`);
  }
  if (['index.html', 'legal.html', 'ninja-admax-frame.html'].includes(name)) return html;
  if (!/<body\b/i.test(html) || /http-equiv=["']refresh/i.test(html)) return html;
  if (html.includes('data-aitech-fullscreen')) return html;
  const src = relative(dirname(file), `${root}/fullscreen.js`).replaceAll('\\', '/');
  return html.replace(/<\/head>/i, `<script src="${src}" defer data-aitech-fullscreen></script>\n</head>`);
}
