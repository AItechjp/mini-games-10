const TAU = Math.PI * 2;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low = 0, high = 1, fallback = low) => Math.max(low, Math.min(high, finite(value, fallback)));
const wrap = (value, range = 1) => ((value % range) + range) % range;
const smoothstep = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t); };
const randomFrom = seed => { let n = seed >>> 0; return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const makeCanvas = (width, height) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
const toPNG = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('画像の保存に失敗しました。')), 'image/png'));
const colorRGB = color => /^#[\da-f]{6}$/i.test(color || '') ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)) : [180, 198, 255];
const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha)})`;

/** Animated 2D illustration. No WebGL, perspective camera, or 3D geometry. */
export class WallpaperRenderer {
  constructor(canvas, { onError } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!this.context) throw new Error('このブラウザではイラストを表示できません。');
    this.onError = typeof onError === 'function' ? onError : () => {};
    this.options = { sparkle: .65, depth: .6, motion: true, brightness: 1 };
    this.pointer = { x: 0, y: 0 };
    this.smoothPointer = { x: 0, y: 0 };
    this.width = 360; this.height = 808; this.time = 0;
    this.lastTime = 0; this.lastPaint = 0; this.frame = 0; this.loadToken = 0;
    this.disposed = false; this.image = null; this.design = null;
    this.imageCache = new Map(); this.raster = null; this.sprites = null; this.particles = [];
    this._tick = this._tick.bind(this);
    this._visibility = () => { if (document.hidden) this._stop(); else { this._render(); this._start(); } };
    this._windowResize = () => this._resize();
    this._resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(this._windowResize) : null;
    this._resizeObserver?.observe(canvas.parentElement || canvas);
    window.addEventListener('resize', this._windowResize);
    document.addEventListener('visibilitychange', this._visibility);
    this._resize();
  }

  get mode() { return 'canvas'; }

  _loadImage(url) {
    if (this.imageCache.has(url)) {
      const entry = this.imageCache.get(url);
      this.imageCache.delete(url); this.imageCache.set(url, entry);
      return entry;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous'; image.decoding = 'async';
    const promise = new Promise((resolve, reject) => {
      image.onload = async () => {
        image.onload = null; image.onerror = null;
        if (image.decode) try { await image.decode(); } catch {}
        if (!image.naturalWidth || !image.naturalHeight) reject(new Error('イラストを読み込めませんでした。'));
        else resolve(image);
      };
      image.onerror = () => { image.onload = null; image.onerror = null; reject(new Error('イラストを読み込めませんでした。通信を確認して、もう一度選んでください。')); };
      image.src = url;
    });
    this.imageCache.set(url, promise);
    // Keep three decoded artworks at most; discarded requests may finish but cannot alter the scene.
    while (this.imageCache.size > 3) this.imageCache.delete(this.imageCache.keys().next().value);
    promise.catch(() => { if (this.imageCache.get(url) === promise) this.imageCache.delete(url); });
    return promise;
  }

  async setDesign(design) {
    if (this.disposed) return false;
    const token = ++this.loadToken;
    let image;
    try { image = await this._loadImage(design.image); }
    catch (error) {
      if (this.disposed || token !== this.loadToken) return false;
      this.onError(error); throw error;
    }
    if (this.disposed || token !== this.loadToken) return false;
    this.design = { ...design, theme: Math.trunc(clamp(design.theme, 0, 9)), variant: Math.trunc(clamp(design.variant, 0, 9)) };
    this.image = image; this.raster = null;
    this.pointer = { x: 0, y: 0 }; this.smoothPointer = { x: 0, y: 0 };
    const random = randomFrom(finite(design.seed, finite(design.id, 1) * 737));
    this.particles = Array.from({ length: 104 }, (_, index) => ({
      x: random(), y: random(), phase: random() * TAU, speed: .65 + random() * 1.2,
      size: 1.4 + random() * 3.4, tilt: random() * TAU, star: index % 13 === 0,
    }));
    this._makeSprites(design.color);
    this._render(); this._start();
    return true;
  }

  setOptions(options = {}) {
    if (this.disposed) return;
    for (const key of ['sparkle', 'depth']) if (options[key] != null) this.options[key] = clamp(options[key], 0, 1, this.options[key]);
    if (options.brightness != null) this.options.brightness = clamp(options.brightness, .5, 1.3, this.options.brightness);
    if (options.motion != null) this.options.motion = !!options.motion;
    if (!this.options.motion) this._stop();
    this._render(); this._start();
  }

  setPointer(x, y) {
    if (this.disposed) return;
    this.pointer.x = clamp(x, -1, 1, 0); this.pointer.y = clamp(y, -1, 1, 0);
    // While paused, retain the exact currently displayed composition, including its offset.
  }

  _resize() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width || this.canvas.parentElement?.clientWidth || this.width);
    const height = Math.max(1, bounds.height || width * 2424 / 1080);
    const dpr = clamp(window.devicePixelRatio, 1, 2, 1);
    const pixelWidth = Math.max(1, Math.round(width * dpr)), pixelHeight = Math.max(1, Math.round(height * dpr));
    this.width = width; this.height = height;
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; this.raster = null;
    }
    this._render();
  }

  _start() {
    if (!this.frame && !this.disposed && !document.hidden && this.options.motion && this.image) {
      this.lastTime = 0; this.lastPaint = 0; this.frame = requestAnimationFrame(this._tick);
    }
  }

  _stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0; this.lastTime = 0; this.lastPaint = 0;
  }

  _tick(now) {
    this.frame = 0;
    if (this.disposed || document.hidden || !this.options.motion || !this.image) { this.lastTime = 0; this.lastPaint = 0; return; }
    if (!this.lastTime) this.lastTime = now;
    const delta = clamp((now - this.lastTime) / 1000, 0, .08);
    this.lastTime = now;
    this.time += delta;
    const smoothing = 1 - Math.exp(-delta * 5);
    this.smoothPointer.x += (this.pointer.x - this.smoothPointer.x) * smoothing;
    this.smoothPointer.y += (this.pointer.y - this.smoothPointer.y) * smoothing;
    if (!this.lastPaint || now - this.lastPaint >= 1000 / 30 - .5) { this._render(); this.lastPaint = now; }
    this.frame = requestAnimationFrame(this._tick);
  }

  _makeSprites(color) {
    const rgb = colorRGB(color);
    const glow = makeCanvas(96, 96), g = glow.getContext('2d');
    const gradient = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(255,255,239,.95)');
    gradient.addColorStop(.13, rgba(rgb, .78)); gradient.addColorStop(.38, rgba(rgb, .22)); gradient.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gradient; g.fillRect(0, 0, 96, 96);
    const star = makeCanvas(96, 96), s = star.getContext('2d');
    s.drawImage(glow, 0, 0); s.translate(48, 48); s.fillStyle = '#fff5d8';
    s.beginPath(); s.moveTo(0, -33); s.quadraticCurveTo(2, -3, 18, 0); s.quadraticCurveTo(2, 3, 0, 33); s.quadraticCurveTo(-2, 3, -18, 0); s.quadraticCurveTo(-2, -3, 0, -33); s.fill();
    const mist = makeCanvas(256, 96), m = mist.getContext('2d');
    m.scale(256, 96); const fog = m.createRadialGradient(.5, .5, 0, .5, .5, .5);
    fog.addColorStop(0, rgba(rgb, .18)); fog.addColorStop(.48, rgba(rgb, .10)); fog.addColorStop(1, rgba(rgb, 0));
    m.fillStyle = fog; m.fillRect(0, 0, 1, 1);
    this.sprites = { glow, star, mist, rgb };
  }

  _rasterFor(width, height, image, brightness = 1) {
    const pad = Math.ceil(width * .06);
    const surface = makeCanvas(width + pad * 2, height + pad * 2);
    const context = surface.getContext('2d', { alpha: false });
    const scale = Math.max(surface.width / image.naturalWidth, surface.height / image.naturalHeight);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.fillStyle = '#090a13'; context.fillRect(0, 0, surface.width, surface.height);
    // Apply brightness once, before the cached illustration is split into moving ink layers.
    // Filtering each of the 64 strip draws would repeat this work on every animation frame.
    if (brightness !== 1) context.filter = `brightness(${brightness})`;
    context.drawImage(image, (surface.width - image.naturalWidth * scale) / 2, (surface.height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
    context.filter = 'none';
    return { surface, pad, width, height, image, brightness };
  }

  _drawIllustration(context, width, height, state, raster) {
    const { time: t, options, design, pointer } = state, k = width / 480;
    const amount = options.depth;
    const offsetX = pointer.x * 3.5 * amount * k;
    const offsetY = pointer.y * 2.4 * amount * k;
    const clothThemes = [2, 3, 4, 9];
    const water = design.theme === 6;
    const organic = clothThemes.includes(design.theme);
    const start = water ? .60 : organic ? .32 : .64;
    const strips = 64, stripHeight = height / strips;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    for (let i = 0; i < strips; i++) {
      const y = i * stripHeight, v = (i + .5) / strips;
      const envelope = smoothstep(start, Math.min(.93, start + .30), v);
      const sway = Math.sin(t * .73 + v * (water ? 38 : 9) + design.theme * .8);
      const ripple = Math.sin(t * (water ? 1.8 : 1.1) + v * (water ? 65 : 17));
      // Adjacent horizontal ink layers flex together: cloth, foliage, smoke, or water.
      // No perspective transform; the upper architecture and faces remain stable.
      const dx = amount * k * (sway * (water ? 5 : organic ? 4.4 : 1.9) + ripple * (water ? 2.3 : .9)) * envelope;
      context.drawImage(raster.surface, raster.pad + offsetX + dx, raster.pad + y + offsetY, width, Math.min(stripHeight + 1, height - y), 0, y, width, Math.min(stripHeight + 1, height - y));
    }
  }

  _drawHaze(context, w, h, state, strong = false) {
    const t = state.time;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let i = 0; i < (strong ? 6 : 3); i++) {
      const p = this.particles[i];
      const x = w * (.5 + Math.sin(t * .14 + p.phase) * .31);
      const y = h * (.34 + i * (strong ? .107 : .22)) + Math.sin(t * .32 + i) * 16;
      context.globalAlpha = strong ? .73 : .34;
      context.drawImage(this.sprites.mist, x - w * .8, y - h * .085, w * 1.6, h * .17);
    }
    context.restore();
  }

  _drawMotes(context, w, h, state) {
    const t = state.time, sparkle = state.options.sparkle;
    if (!sparkle) return;
    context.save(); context.globalCompositeOperation = 'screen';
    const count = Math.round(24 + sparkle * 64);
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const x = wrap(p.x + Math.sin(t * .32 + p.phase) * .021) * w;
      const y = wrap(p.y - t * .006 * p.speed) * h;
      const blink = .18 + .82 * Math.pow(.5 + .5 * Math.sin(t * (1.1 + p.speed * .4) + p.phase), 2);
      const size = p.star ? 22 + p.size * 2.4 : p.size * 3.4;
      context.globalAlpha = sparkle * blink * (p.star ? .82 : .74);
      context.drawImage(p.star ? this.sprites.star : this.sprites.glow, x - size / 2, y - size / 2, size, size);
    }
    context.restore();
  }

  _drawLeaf(context, x, y, size, angle, color, feather = false) {
    context.save(); context.translate(x, y); context.rotate(angle);
    context.fillStyle = color; context.strokeStyle = 'rgba(245,233,213,.5)'; context.lineWidth = .55;
    context.beginPath(); context.moveTo(-size, 0);
    context.bezierCurveTo(-size * .35, -size * (feather ? .35 : .62), size * .85, -size * .44, size, 0);
    context.bezierCurveTo(size * .15, size * .7, -size * .6, size * .47, -size, 0); context.fill();
    context.beginPath(); context.moveTo(-size * .9, 0); context.quadraticCurveTo(0, size * .09, size * 1.15, -.6); context.stroke();
    if (feather) { for (let j = -2; j <= 2; j++) { context.beginPath(); context.moveTo(j * size / 4, 0); context.lineTo((j - .7) * size / 4, -size * .25); context.moveTo(j * size / 4, 0); context.lineTo((j - .65) * size / 4, size * .29); context.stroke(); } }
    context.restore();
  }

  _drawDrift(context, w, h, state, kind, count = 20) {
    const t = state.time, rgb = this.sprites.rgb;
    context.save();
    for (let i = 0; i < count; i++) {
      const p = this.particles[30 + i], falling = kind !== 'ember';
      const speed = kind === 'snow' ? .018 : kind === 'ember' ? -.033 : .017;
      const x = wrap(p.x + Math.sin(t * .5 + p.phase) * .055 + t * .0035) * w;
      const y = wrap(p.y + t * speed * p.speed) * h;
      const size = p.size * (kind === 'feather' ? 2 : kind === 'leaf' || kind === 'petal' ? 1.35 : .65);
      context.globalAlpha = .40 + .35 * Math.sin(Math.PI * y / h);
      if (kind === 'leaf' || kind === 'feather' || kind === 'petal') {
        const color = kind === 'petal' ? ['#cf6d91', '#e9adbf', '#8f3762'][i % 3] : kind === 'leaf' ? ['#68cbb1', '#accb9d', '#618478'][i % 3] : '#e7d7be';
        this._drawLeaf(context, x, y, size, p.tilt + Math.sin(t * .78 + p.phase) * 1.3 + t * .08, color, kind === 'feather');
      } else if (kind === 'ember') {
        context.fillStyle = i % 3 ? '#ffc37c' : '#ff6b50'; context.fillRect(x, y, size, size * 1.8);
      } else {
        context.fillStyle = kind === 'snow' ? '#ecf8ff' : rgba(rgb, .9); context.beginPath(); context.arc(x, y, size, 0, TAU); context.fill();
        if (kind === 'snow' && i % 6 === 0) {
          context.strokeStyle = '#e4f5ff'; context.lineWidth = .65;
          for (let j = 0; j < 3; j++) { const a = j * Math.PI / 3 + t * .2; context.beginPath(); context.moveTo(x - Math.cos(a) * size * 2.4, y - Math.sin(a) * size * 2.4); context.lineTo(x + Math.cos(a) * size * 2.4, y + Math.sin(a) * size * 2.4); context.stroke(); }
        }
      }
    }
    context.restore();
  }

  _drawFlames(context, w, h, state, count = 2) {
    const t = state.time;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
      const x = w * (i % 2 ? .9 : .1), y = h * (.79 + Math.floor(i / 2) * .13);
      const flicker = Math.sin(t * 4.2 + i) * 4 + Math.sin(t * 7.1 + i) * 2;
      const size = 27 + flicker;
      context.globalAlpha = .2; context.drawImage(this.sprites.glow, x - size * 2.5, y - size * 2.7, size * 5, size * 5);
      context.globalAlpha = .7; context.fillStyle = '#ef956c';
      context.beginPath(); context.moveTo(x, y + 12); context.bezierCurveTo(x - 10, y + 4, x - 6, y - 16, x + flicker, y - 31 - flicker);
      context.bezierCurveTo(x + 2, y - 12, x + 15, y + 5, x, y + 12); context.fill();
      context.fillStyle = '#ffe1a4'; context.beginPath(); context.moveTo(x, y + 8); context.quadraticCurveTo(x - 5, y + 1, x + flicker * .35, y - 12); context.quadraticCurveTo(x + 6, y + 3, x, y + 8); context.fill();
    }
    context.restore();
  }

  _drawTheme(context, w, h, state) {
    const t = state.time, theme = state.design.theme, rgb = this.sprites.rgb;
    if (theme === 2) this._drawDrift(context, w, h, state, 'ember', 23);
    else if (theme === 4) this._drawDrift(context, w, h, state, 'leaf', 17);
    else if (theme === 7) this._drawDrift(context, w, h, state, 'snow', 22);
    else if (theme === 8) { this._drawDrift(context, w, h, state, 'petal', 13); this._drawFlames(context, w, h, state); }
    else if (theme === 9) this._drawDrift(context, w, h, state, 'feather', 16);
    else this._drawDrift(context, w, h, state, 'dust', 17);
    if (theme === 6) {
      context.save(); context.strokeStyle = rgba(rgb, .24); context.lineWidth = .8;
      for (let i = 0; i < 8; i++) {
        const y = h * (.76 + i * .026); context.beginPath();
        for (let j = 0; j <= 24; j++) { const x = j / 24 * w, yy = y + Math.sin(j * .59 + t * 1.1 + i) * (2 + i * .4); if (!j) context.moveTo(x, yy); else context.lineTo(x, yy); }
        context.stroke();
      }
      context.restore();
    }
    if (theme === 1 || theme === 5) {
      context.save(); context.globalCompositeOperation = 'screen'; context.strokeStyle = rgba(rgb, .22); context.lineWidth = .8;
      for (let i = 0; i < 7; i++) {
        const p = this.particles[70 + i], x = (i % 2 ? .90 : .10) * w + Math.sin(t * .35 + i) * 7, y = h * (.20 + i * .103) + Math.sin(t * .6 + i) * 7;
        context.save(); context.translate(x, y); context.rotate(Math.sin(t * .23 + i) * .15); context.beginPath();
        context.moveTo(0, -9); context.lineTo(5, 0); context.lineTo(0, 9); context.lineTo(-5, 0); context.closePath(); context.moveTo(-8, 0); context.lineTo(8, 0); context.stroke();
        context.globalAlpha = .3 + Math.sin(t + p.phase) * .2; context.drawImage(this.sprites.glow, -16, -16, 32, 32); context.restore();
      }
      context.restore();
    }
  }

  _drawMoonlight(context, w, h, state) {
    const t = state.time, rgb = this.sprites.rgb;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = w * (.14 + i * .27) + Math.sin(t * .22 + i) * 18;
      const light = context.createLinearGradient(x, h * .10, x + 75, h * .85);
      light.addColorStop(0, rgba(rgb, .12)); light.addColorStop(.65, rgba(rgb, .025)); light.addColorStop(1, rgba(rgb, 0));
      context.fillStyle = light; context.globalAlpha = .6 + Math.sin(t * .67 + i) * .22;
      context.beginPath(); context.moveTo(x, h * .06); context.lineTo(x + 11, h * .06); context.lineTo(x + 145, h * .85); context.lineTo(x + 20, h * .85); context.closePath(); context.fill();
    }
    context.restore();
  }

  _drawMeteors(context, w, h, state) {
    const t = state.time;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const p = this.particles[90 + i], phase = wrap(t * .16 + p.phase / TAU + i * .13);
      if (phase > .30) continue;
      const progress = phase / .30, x = (p.x * .8 + progress * .54 - .20) * w, y = (.06 + p.y * .27 + progress * .20) * h;
      const alpha = Math.sin(progress * Math.PI), length = 45 + p.size * 9;
      const tail = context.createLinearGradient(x - length, y - length * .63, x, y);
      tail.addColorStop(0, rgba(this.sprites.rgb, 0)); tail.addColorStop(1, '#f8eadc'); context.strokeStyle = tail; context.lineWidth = 1.2; context.globalAlpha = alpha * .85;
      context.beginPath(); context.moveTo(x - length, y - length * .63); context.lineTo(x, y); context.stroke(); context.drawImage(this.sprites.glow, x - 10, y - 10, 20, 20);
    }
    context.restore();
  }

  _drawFireflies(context, w, h, state) {
    const t = state.time;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let i = 0; i < 34; i++) {
      const p = this.particles[45 + i], x = (p.x + Math.sin(t * .7 + p.phase) * .07) * w, y = (p.y + Math.sin(t * .52 + p.phase * 2) * .028) * h;
      context.globalAlpha = .18 + .72 * Math.pow(.5 + .5 * Math.sin(t * 1.7 + p.phase), 2);
      const size = 12 + p.size * 4; context.drawImage(this.sprites.glow, x - size / 2, y - size / 2, size, size);
    }
    context.restore();
  }

  _drawRain(context, w, h, state) {
    const t = state.time;
    context.save(); context.strokeStyle = rgba(this.sprites.rgb, .56); context.lineWidth = .75;
    for (let i = 0; i < 68; i++) {
      const p = this.particles[i], y = wrap(p.y + t * .33 * p.speed) * h, x = wrap(p.x + t * .027 * p.speed) * w;
      context.globalAlpha = .24 + p.size * .065; context.beginPath(); context.moveTo(x, y); context.lineTo(x - 3.6, y - 16 - p.size * 3); context.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const p = this.particles[80 + i], age = wrap(t * .67 + p.phase / TAU), x = p.x * w, y = h * (.82 + p.y * .16);
      context.globalAlpha = (1 - age) * .22; context.beginPath(); context.ellipse(x, y, 2 + age * 21, 1 + age * 4, 0, 0, TAU); context.stroke();
    }
    context.restore();
  }

  _drawSigil(context, w, h, state) {
    const t = state.time, radius = w * .37;
    context.save(); context.translate(w * .5, h * .77); context.globalCompositeOperation = 'screen';
    context.globalAlpha = .22 + Math.sin(t * 1.1) * .06; context.strokeStyle = this.design.color; context.lineWidth = 1;
    context.rotate(t * .045);
    for (const scale of [1, .92, .70]) { context.beginPath(); context.arc(0, 0, radius * scale, 0, TAU); context.stroke(); }
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, x = Math.cos(a) * radius * .82, y = Math.sin(a) * radius * .82;
      context.save(); context.translate(x, y); context.rotate(a + Math.PI / 2); context.beginPath(); context.moveTo(-3, -5); context.lineTo(0, 4); context.lineTo(3, -5); context.moveTo(-4, 0); context.lineTo(4, 0); context.stroke(); context.restore();
    }
    context.rotate(-t * .09); context.beginPath();
    for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU, x = Math.cos(a) * radius * .70, y = Math.sin(a) * radius * .70; if (!i) context.moveTo(x, y); else context.lineTo(x, y); } context.stroke();
    context.restore();
  }

  _drawAurora(context, w, h, state) {
    const t = state.time;
    context.save(); context.globalCompositeOperation = 'screen';
    for (let layer = 0; layer < 3; layer++) {
      const gradient = context.createLinearGradient(0, h * .08, 0, h * .5);
      gradient.addColorStop(0, rgba(this.sprites.rgb, 0)); gradient.addColorStop(.40, rgba(this.sprites.rgb, .055)); gradient.addColorStop(.7, rgba(this.sprites.rgb, .15)); gradient.addColorStop(1, rgba(this.sprites.rgb, 0)); context.fillStyle = gradient;
      context.beginPath();
      for (let i = 0; i <= 32; i++) { const x = i / 32 * w, y = h * (.11 + layer * .06) + Math.sin(i * .15 + t * .33 + layer) * 35; if (!i) context.moveTo(x, y); else context.lineTo(x, y); }
      for (let i = 32; i >= 0; i--) { const x = i / 32 * w, y = h * (.29 + layer * .065) + Math.sin(i * .15 + t * .33 + layer + .8) * 49; context.lineTo(x, y); }
      context.closePath(); context.fill();
    }
    context.restore();
  }

  _compose(context, width, height, state, raster) {
    context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#090a13'; context.fillRect(0, 0, width, height);
    if (!state.image || !state.design || !this.sprites) return;
    this._drawIllustration(context, width, height, state, raster);
    const w = 480, h = height / width * w;
    context.save(); context.scale(width / w, width / w);
    this._drawHaze(context, w, h, state, state.design.variant === 2);
    this._drawTheme(context, w, h, state);
    switch (state.design.variant) {
      case 0: this._drawMoonlight(context, w, h, state); break;
      case 1: this._drawMeteors(context, w, h, state); break;
      case 2: this._drawMoonlight(context, w, h, state); break;
      case 3: this._drawFireflies(context, w, h, state); break;
      case 4: this._drawRain(context, w, h, state); break;
      case 5: this._drawDrift(context, w, h, state, 'petal', 32); break;
      case 6: this._drawSigil(context, w, h, state); break;
      case 7: this._drawFlames(context, w, h, state, 4); this._drawDrift(context, w, h, state, 'ember', 35); break;
      case 8: this._drawDrift(context, w, h, state, 'snow', 45); break;
      case 9: this._drawAurora(context, w, h, state); break;
    }
    this._drawMotes(context, w, h, state);
    const vignette = context.createLinearGradient(0, 0, 0, h);
    vignette.addColorStop(0, 'rgba(5,7,16,.20)'); vignette.addColorStop(.2, 'rgba(5,7,16,0)'); vignette.addColorStop(.73, 'rgba(5,7,16,0)'); vignette.addColorStop(1, 'rgba(5,7,16,.27)');
    context.fillStyle = vignette; context.fillRect(0, 0, w, h); context.restore();
  }

  _snapshot() {
    return { image: this.image, design: this.design, time: this.time, options: { ...this.options }, pointer: { ...this.smoothPointer } };
  }

  _render() {
    if (this.disposed) return;
    const width = this.canvas.width, height = this.canvas.height;
    if (this.image && (!this.raster || this.raster.width !== width || this.raster.height !== height || this.raster.image !== this.image || this.raster.brightness !== this.options.brightness)) this.raster = this._rasterFor(width, height, this.image, this.options.brightness);
    this._compose(this.context, width, height, this._snapshot(), this.raster);
  }

  async renderStill(width = 1080, height = 2424) {
    if (this.disposed || !this.image || !this.design) throw new Error('イラストの読み込みが終わってから保存してください。');
    width = Math.round(clamp(width, 1, 4096, 1080)); height = Math.round(clamp(height, 1, 8192, 2424));
    if (width * height > 16777216) throw new Error('保存する画像のサイズが大きすぎます。');
    const state = this._snapshot(), canvas = makeCanvas(width, height), context = canvas.getContext('2d', { alpha: false });
    // Export owns its raster and canvas: it never resizes, pauses, or resets the live preview.
    this._compose(context, width, height, state, this._rasterFor(width, height, state.image, state.options.brightness));
    return toPNG(canvas);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true; this.loadToken++; this._stop();
    this._resizeObserver?.disconnect(); window.removeEventListener('resize', this._windowResize);
    document.removeEventListener('visibilitychange', this._visibility);
    this.imageCache.clear(); this.image = null; this.design = null; this.raster = null; this.sprites = null; this.particles.length = 0;
  }
}
