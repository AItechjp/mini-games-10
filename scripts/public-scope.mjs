// Publication scope requested on 2026-10-04. Historical source stays in Git,
// outside the website artifact; only Commons and the remaining 2D collection ship.
export const retainedGames = ['pulse-drums', 'pixel-wallpapers', 'cyber-quiz', 'music',
  'law-quiz', 'it-quiz', 'hacking-story', 'lantern-duo', 'quick-hop', 'startrail'];
const directories = ['commons', ...retainedGames, 'app-guide', 'quality', 'assets/tanto', 'assets/ronbun'];
const files = new Set([
  'index.html', 'games.html', 'games-2d.html', 'legal.html',
  'aitech-home.css', 'hub.css', 'games-categories.css', 'collection-nav.css', 'legal.css',
  'fullscreen.js', 'game-viewport.js', 'game-viewport.css',
  'supabase-config.js', 'peer-supabase-shim.js', 'ads-config.js', 'ads-bootstrap.js', 'ads.txt',
  'yobi-quiz.html', 'yobi-ronbun.html', 'yobi-past.js', 'yobi-past.css', 'yobi-engine.js',
  'ronbun.js', 'ronbun.css', 'ronbun-engine.js', 'study-storage.js',
  'quiz-raid/app.mjs', 'quiz-raid/core.mjs', 'quiz-raid/scene.mjs', 'quiz-raid/style.css',
  // Shared renderer required by the retained LAW/IT quiz pages, not a board game.
  'board-games/vendor/three.mjs', 'board-games/vendor/three-LICENSE.txt',
  'CNAME', '.nojekyll', '_headers', '_redirects', 'https-release.json',
]);
export function isPublicPath(path) {
  path = path.replaceAll('\\', '/').replace(/^\.\//, '');
  return files.has(path) || directories.some(dir => path.startsWith(dir + '/'));
}
export function containsPublicPath(path) {
  path = path.replaceAll('\\', '/');
  return directories.some(dir => dir === path || dir.startsWith(path + '/') || path.startsWith(dir + '/')) ||
    [...files].some(file => file.startsWith(path + '/'));
}
