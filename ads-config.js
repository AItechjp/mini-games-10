// Auto ads must also be enabled for aitechd.com in the AdSense dashboard.
// Keep ads on catalog pages, away from game controls and private tool contents.
window.SITE_ADSENSE = Object.assign({
  enabled: true,
  client: "ca-pub-5820558629755748",
  autoAds: true,
  paths: [
    "/", "/index.html", "/games.html", "/games-3d.html", "/games-2d.html",
    "/games-trump.html", "/games-board.html", "/commons/", "/commons/index.html"
  ]
}, window.SITE_ADSENSE || {});
