// Legacy Ninja AdMax iframe configuration.
// Disabled because the supplied synchronous tag must run directly in the page parser.
window.SITE_NINJA_ADMAX = Object.assign({
  enabled: false,
  frameSrc: "ninja-admax-frame.html",
  placement: "after-hero"
}, window.SITE_NINJA_ADMAX || {});
