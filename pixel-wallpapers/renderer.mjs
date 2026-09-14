import * as THREE from './vendor/three.mjs';

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number(v) || 0));
const makeRandom = (seed) => { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const blobFromCanvas = (canvas) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像の保存に失敗しました。')), 'image/png'));

const backdropVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const backdropFragment = `
  uniform sampler2D uImage; uniform vec2 uCover; uniform vec2 uPointer;
  uniform float uDepth; uniform float uBrightness; uniform float uTime; uniform float uVariant;
  varying vec2 vUv;
  void main(){
    vec2 uv=(vUv-.5)*uCover+.5;
    vec3 base=texture2D(uImage,uv).rgb;
    float light=dot(base,vec3(.2126,.7152,.0722));
    float radial=length((vUv-.5)*vec2(1.,.58));
    float planeDepth=.25+light*.26+smoothstep(.1,.65,radial)*.32;
    vec2 offset=uPointer*uDepth*.018*planeDepth;
    offset+=vec2(sin(vUv.y*7.+uTime*.13+uVariant),cos(vUv.x*5.+uTime*.11))*.0007*uDepth;
    vec3 col=texture2D(uImage,clamp(uv+offset*uCover,vec2(.002),vec2(.998))).rgb;
    float vignette=1.-smoothstep(.28,.77,length((vUv-.5)*vec2(1.,.85)))*.19;
    col*=vignette*uBrightness;
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;
const particleVertex = `
  uniform float uTime; uniform float uHeight; uniform float uDepth; uniform vec2 uPointer;
  attribute float aSize; attribute float aPhase; attribute float aStar;
  varying float vAlpha; varying float vStar;
  void main(){
    vec3 p=position;
    p.x+=sin(uTime*.105+aPhase)*.014;
    p.y+=sin(uTime*.15+aPhase*1.3)*.018;
    p.xy+=uPointer*.012*(p.z+2.)*uDepth;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=min(76.,aSize*uHeight/900.);
    vAlpha=.4+.6*pow(.5+.5*sin(uTime*(.4+aStar*.8)+aPhase),2.);
    vStar=aStar;
  }`;
const particleFragment = `
  uniform vec3 uColor; uniform float uSparkle; uniform float uBrightness;
  varying float vAlpha; varying float vStar;
  void main(){
    vec2 p=gl_PointCoord-.5; float r=length(p); if(r>.5)discard;
    float core=exp(-r*r*175.);
    float halo=exp(-r*r*28.)*.19;
    float crossGlow=exp(-abs(p.x)*110.)*pow(max(0.,1.-abs(p.y)*2.),3.);
    crossGlow+=exp(-abs(p.y)*110.)*pow(max(0.,1.-abs(p.x)*2.),3.);
    float a=(core+halo+crossGlow*vStar*.8)*vAlpha*uSparkle;
    gl_FragColor=vec4(mix(uColor,vec3(1.),core*.8)*(.65+uBrightness*.65),a);
    #include <colorspace_fragment>
  }`;

/** Live artwork depth preview. Sparkle/depth: 0..1. Brightness: .5..1.3 (1 is original). */
export class WallpaperRenderer {
  constructor(canvas, { onError } = {}) {
    this.canvas = canvas;
    this.onError = typeof onError === 'function' ? onError : () => {};
    this.options = { sparkle: .65, depth: .6, motion: true, brightness: 1 };
    this.pointer = { x: 0, y: 0 };
    this.smoothPointer = { x: 0, y: 0 };
    this.width = 360; this.height = 808; this.dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    this.time = 0; this.lastTime = 0; this.frame = 0; this.loadToken = 0;
    this.disposed = false; this.image = null; this.design = null; this.animations = [];
    this.fallbackParticles = []; this.fallbackSprites = null; this.fallbackVignettes = new WeakMap(); this._tick = this._tick.bind(this);
    this._visibility = () => { if (document.hidden) this._stop(); else { this.lastTime = 0; this._render(); this._start(); } };
    try { this._initWebGL(); } catch (error) { this._initFallback(error); }
    this._contextLost = event => { event.preventDefault(); this._stop(); this._initFallback(new Error('3D 描画を簡易表示に切り替えました。')); this._resize(); this._start(); };
    canvas.addEventListener('webglcontextlost', this._contextLost, false);
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas.parentElement || canvas);
    document.addEventListener('visibilitychange', this._visibility);
    this._resize(); this._start();
  }

  get mode() { return this.renderer ? 'webgl' : 'canvas'; }

  _initWebGL() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#08060f');
    this.scene.fog = new THREE.FogExp2('#100b24', .026);
    this.camera = new THREE.OrthographicCamera(-.445, .445, 1, -1, .1, 30);
    this.camera.position.z = 10;
    this.backgroundMaterial = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: backdropFragment, depthWrite: false, depthTest: false, toneMapped: false,
      uniforms: { uImage: { value: null }, uCover: { value: new THREE.Vector2(1, 1) }, uPointer: { value: new THREE.Vector2() }, uDepth: { value: .65 }, uBrightness: { value: .7 }, uTime: { value: 0 }, uVariant: { value: 0 } }
    });
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.backgroundMaterial);
    this.backdrop.position.z = -5; this.backdrop.renderOrder = -100; this.backdrop.visible = false;
    this.scene.add(this.backdrop);
    this.decorations = new THREE.Group(); this.scene.add(this.decorations);
    this.scene.add(new THREE.HemisphereLight('#d6d0ff', '#271231', 2.1));
    this.keyLight = new THREE.DirectionalLight('#fff0e5', 3.5); this.keyLight.position.set(-3, 5, 8); this.scene.add(this.keyLight);
    this.rimLight = new THREE.DirectionalLight('#9c7cff', 4.2); this.rimLight.position.set(4, -1, 2); this.scene.add(this.rimLight);
  }

  _initFallback(error) {
    if (this.renderer) { try { this.renderer.dispose(); } catch {} this.renderer = null; }
    let context = this.canvas.getContext('2d');
    if (!context) {
      const alternate = this.canvas.cloneNode(false);
      alternate.removeAttribute('id'); alternate.setAttribute('aria-hidden', 'true');
      this._originalCanvasOpacity = this.canvas.style.opacity;
      this.canvas.style.opacity = '0';
      Object.assign(alternate.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
      this.canvas.insertAdjacentElement('afterend', alternate);
      this.fallbackCanvas = alternate; context = alternate.getContext('2d');
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver.observe(this.canvas.parentElement || this.canvas); }
    }
    this.context = context;
    if (error) this.onError(error);
  }

  async setDesign(design) {
    const token = ++this.loadToken;
    const image = new Image(); image.crossOrigin = 'anonymous'; image.decoding = 'async';
    let loadError = null;
    try {
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('背景画像を読み込めませんでした。通信を確認して、もう一度選択してください。')); image.src = design.image; });
      if (image.decode) await image.decode().catch(() => {});
    } catch (error) { loadError = error; }
    if (this.disposed || token !== this.loadToken) return false;
    this.design = design; this.image = loadError ? null : image;
    this.smoothPointer.x = 0; this.smoothPointer.y = 0; this.pointer.x = 0; this.pointer.y = 0;
    const random = makeRandom(design.seed || design.id * 737);
    this._makeFallbackSprites(design.color);
    this.fallbackParticles = Array.from({ length: 120 }, (_, index) => ({ x: random(), y: random(), size: index % 17 === 0 ? 12 + random() * 9 : 1.3 + random() * 3.5, phase: random() * Math.PI * 2, star: index % 17 === 0 }));
    if (this.renderer) {
      if (this.texture) this.texture.dispose();
      this.texture = this.image ? new THREE.Texture(image) : null;
      if (this.texture) { this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.minFilter = THREE.LinearFilter; this.texture.magFilter = THREE.LinearFilter; this.texture.generateMipmaps = false; this.texture.needsUpdate = true; }
      this.backdrop.visible = !!this.image;
      this.backgroundMaterial.uniforms.uImage.value = this.texture;
      this.backgroundMaterial.uniforms.uVariant.value = design.variant;
      this.rimLight.color.set(design.color);
      this._buildDecorations(); this._updateCover(this.width / this.height);
    }
    this._render();
    if (loadError) { this.onError(loadError); throw loadError; }
    return true;
  }

  setOptions(options = {}) {
    for (const key of ['sparkle', 'depth']) if (options[key] != null) this.options[key] = clamp(options[key]);
    if (options.brightness != null) this.options.brightness = clamp(options.brightness, .5, 1.3);
    if (options.motion != null) this.options.motion = !!options.motion;
    if (!this.options.motion) this._stop();
    this._render(); this._start();
  }

  setPointer(x, y) {
    this.pointer.x = clamp(x, -1, 1); this.pointer.y = clamp(y, -1, 1);
    if (!this.options.motion) { this.smoothPointer.x = 0; this.smoothPointer.y = 0; this._render(); }
  }

  _disposeDecorations() {
    if (!this.decorations) return;
    const geometries = new Set(), materials = new Set();
    this.decorations.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) { if (Array.isArray(object.material)) object.material.forEach(m => materials.add(m)); else materials.add(object.material); } });
    if (this.ringMaterial) materials.add(this.ringMaterial);
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.decorations.clear(); this.animations.length = 0; this.particleMaterial = null;
  }

  _buildDecorations() {
    this._disposeDecorations();
    const d = this.design, random = makeRandom((d.seed || d.id * 731) + 19);
    const color = new THREE.Color(d.color);
    const geometry = this._crystalGeometry(5 + d.theme % 2);
    const edgesGeometry = new THREE.EdgesGeometry(geometry, 15);
    const gemMaterial = new THREE.MeshPhysicalMaterial({ color, metalness: .62, roughness: .18, clearcoat: 1, clearcoatRoughness: .12, emissive: color, emissiveIntensity: .28, transparent: true, opacity: .82, side: THREE.DoubleSide });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), .65), transparent: true, opacity: .28 });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), .35), transparent: true, opacity: .27, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    let gemCount = 0;
    const gem = (x, y, scale, turn = 0, tilt = .15) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, gemMaterial)); group.add(new THREE.LineSegments(edgesGeometry, edgeMaterial));
      group.position.set(x, y, .5 + random() * 1.1);
      group.scale.set(scale * (.7 + random() * .3), scale * (1.2 + random() * .8), scale * .7);
      group.rotation.set(tilt, random() * Math.PI, turn);
      this.decorations.add(group); this.animations.push({ object: group, x, y, rx: group.rotation.x, ry: group.rotation.y, rz: group.rotation.z, phase: random() * 6.28, type: 'gem' }); gemCount++;
      return group;
    };
    const ring = (x, y, radius, tilt, turn, arc = Math.PI * 2) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, .0012 + random() * .001, 4, arc < 6 ? 72 : 112, arc), ringMaterial);
      mesh.position.set(x, y, .6); mesh.rotation.set(tilt, .18, turn);
      this.decorations.add(mesh); this.animations.push({ object: mesh, x, y, rx: tilt, ry: .18, rz: turn, phase: random() * 6.28, type: 'ring' });
      return mesh;
    };
    // Composition varies by geometry and placement; the central artwork stays unobstructed.
    switch (d.variant % 10) {
      case 0: // Floating crystals.
        for (let i = 0; i < 5; i++) gem(.55 + i * .09, -.68 - i * .042, .046 + random() * .03, -.3 + i * .22);
        ring(-.47, .72, .32, .5, .4, 4.4); break;
      case 1: // Celestial orbital rings.
        ring(.12, -.64, .47, 1.1, .2); ring(.12, -.64, .39, .55, -.45); ring(-.68, .71, .22, .5, .3, 4.8);
        gem(-.8, -.6, .022, .4); gem(.72, -.77, .027, -.2); gem(.8, .72, .023, .7); break;
      case 2: // Diagonal crystal rain.
        for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1; gem(side * (.59 + random() * .36), -.94 + random() * 1.86, .018 + random() * .029, -.42, .35); } break;
      case 3: // Dark angular floating fragments.
        gemMaterial.color.multiplyScalar(.32); gemMaterial.emissive.multiplyScalar(.18); gemMaterial.metalness = .86; gemMaterial.roughness = .42;
        for (let i = 0; i < 9; i++) { const shard = gem((i % 2 ? 1 : -1) * (.66 + random() * .23), -.86 + random() * 1.69, .026 + random() * .036, random() * 2, .6); shard.scale.y *= .62; shard.scale.z *= .35; } break;
      case 4: // Arcane ground seal.
        ring(0, -.66, .51, 1.12, .15); ring(0, -.66, .42, 1.12, -.2); ring(0, -.66, .30, 1.12, 1.2, 5.2);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; gem(Math.cos(a) * .59, -.66 + Math.sin(a) * .19, .024, a); } break;
      case 5: { // A linked constellation across the sky.
        const nodes = [[-.87,.67],[-.63,.82],[-.27,.66],[.11,.81],[.49,.68],[.83,.88]], lines = [];
        for (let i = 0; i < nodes.length; i++) { const [x,y] = nodes[i]; gem(x, y, .013, .6); if (i) lines.push(...nodes[i - 1], .7, x, y, .7); }
        const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
        this.decorations.add(new THREE.LineSegments(lineGeometry, edgeMaterial));
        gem(-.79, -.74, .024, .2); gem(.8, -.82, .018, -.5); break;
      }
      case 6: // Twin rings.
        ring(-.68, -.5, .47, .72, -.65); ring(.67, .63, .38, -.67, .75);
        gem(-.84, -.79, .035, .6); gem(.86, .37, .029, -.45); break;
      case 7: // A crystal crown, with a central spire.
        for (let i = 0; i < 7; i++) { const x = (i - 3) * .18; gem(x, -.72 + Math.abs(i - 3) * .025, .035 + (3 - Math.abs(i - 3)) * .009, (i - 3) * -.16, .16); }
        ring(0, -.82, .57, 1.27, .0, Math.PI); ring(0, -.84, .53, 1.27, .0, Math.PI); break;
      case 8: // Armillary celestial sphere.
        gem(.05, -.61, .078, -.1, .1); gem(-.24, -.74, .021, .6); gem(.33, -.52, .021, -.7);
        ring(.05, -.66, .32, 1.1, .1); ring(.05, -.59, .29, -.8, .6); ring(.05, -.64, .35, .3, 1.9); break;
      case 9: { // Distant floating lantern lights, no crystal cluster.
        const lightGeometry = new THREE.SphereGeometry(.009, 8, 6);
        const lightMaterial = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color('#fff2c2'), .7), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
        for (let i = 0; i < 8; i++) {
          const lamp = new THREE.Mesh(lightGeometry, lightMaterial), x = (i % 2 ? 1 : -1) * (.5 + random() * .4), y = -.86 + random() * 1.68;
          lamp.position.set(x, y, .8); lamp.scale.set(.52, 1 + random() * .6, .52); this.decorations.add(lamp);
          this.animations.push({ object: lamp, x, y, rx: 0, ry: 0, rz: 0, phase: random() * 6.28, type: 'lamp' });
        }
        break;
      }
    }
    if (!gemCount) { geometry.dispose(); edgesGeometry.dispose(); gemMaterial.dispose(); edgeMaterial.dispose(); }
    const n = 144, positions = new Float32Array(n * 3), sizes = new Float32Array(n), phases = new Float32Array(n), stars = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (random() - .5) * 1.98; positions[i * 3 + 1] = (random() - .5) * 1.98; positions[i * 3 + 2] = random() * 3;
      stars[i] = i % 19 === 0 ? 1 : 0; sizes[i] = stars[i] ? 30 + random() * 19 : 3 + random() * 8; phases[i] = random() * Math.PI * 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); particleGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1)); particleGeometry.setAttribute('aStar', new THREE.BufferAttribute(stars, 1));
    this.particleMaterial = new THREE.ShaderMaterial({ vertexShader: particleVertex, fragmentShader: particleFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, uniforms: { uTime: { value: this.time }, uHeight: { value: this.height * this.dpr }, uDepth: { value: this.options.depth }, uPointer: { value: new THREE.Vector2() }, uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), .5) }, uSparkle: { value: this.options.sparkle }, uBrightness: { value: this.options.brightness } } });
    const points = new THREE.Points(particleGeometry, this.particleMaterial); points.renderOrder = 10; this.decorations.add(points);
    this.gemMaterial = gemMaterial; this.edgeMaterial = edgeMaterial; this.ringMaterial = ringMaterial;
  }

  _crystalGeometry(sides) {
    const positions = [];
    const face = (a, b, c) => positions.push(...a, ...b, ...c);
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      const p = [Math.cos(a) * .45, .05, Math.sin(a) * .45], q = [Math.cos(b) * .45, .05, Math.sin(b) * .45];
      face([.08, 1, -.06], p, q); face([-.04, -.75, .03], q, p);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); return geometry;
  }

  _updateCover(aspect) {
    if (!this.renderer) return;
    this.backdrop.scale.x = aspect;
    this.decorations.scale.x = aspect;
    if (!this.image) return;
    const sourceAspect = this.image.naturalWidth / this.image.naturalHeight;
    const cover = this.backgroundMaterial.uniforms.uCover.value;
    const inset = 1 / (1.035 + (this.design?.variant % 3 || 0) * .006);
    if (sourceAspect > aspect) cover.set(aspect / sourceAspect * inset, inset);
    else cover.set(inset, sourceAspect / aspect * inset);
  }

  _resize() {
    if (this.disposed) return;
    const target = this.fallbackCanvas || this.canvas;
    const rect = target.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width || this.width)); this.height = Math.max(1, Math.round(rect.height || this.height));
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.camera.left = -this.width / this.height; this.camera.right = this.width / this.height; this.camera.updateProjectionMatrix();
      this._updateCover(this.width / this.height);
    } else if (this.context) { target.width = Math.round(this.width * this.dpr); target.height = Math.round(this.height * this.dpr); }
    this._render();
  }

  _start() { if (!this.disposed && this.options.motion && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this._tick); }
  _stop() { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = 0; }
  _tick(now) {
    this.frame = 0;
    if (this.disposed || document.hidden || !this.options.motion) return;
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, .05) : 0;
    this.lastTime = now; this.time += dt;
    const follow = 1 - Math.exp(-dt * 5);
    this.smoothPointer.x += (this.pointer.x - this.smoothPointer.x) * follow;
    this.smoothPointer.y += (this.pointer.y - this.smoothPointer.y) * follow;
    this._render(); this._start();
  }

  _prepareFrame(pixelHeight) {
    const o = this.options, p = this.smoothPointer;
    const pointerX = o.motion ? p.x : 0, pointerY = o.motion ? p.y : 0;
    const bg = this.backgroundMaterial.uniforms;
    bg.uPointer.value.set(pointerX, pointerY); bg.uDepth.value = o.depth; bg.uBrightness.value = o.brightness; bg.uTime.value = this.time;
    if (this.particleMaterial) {
      const u = this.particleMaterial.uniforms; u.uTime.value = this.time; u.uHeight.value = pixelHeight;
      u.uDepth.value = o.depth; u.uPointer.value.set(pointerX, pointerY); u.uSparkle.value = o.sparkle; u.uBrightness.value = o.brightness;
    }
    if (this.gemMaterial) {
      this.gemMaterial.emissiveIntensity = .12 + o.sparkle * .36;
      this.gemMaterial.opacity = .48 + o.depth * .37;
      this.edgeMaterial.opacity = .11 + o.sparkle * .23;
      this.ringMaterial.opacity = .10 + o.sparkle * .28;
    }
    for (const a of this.animations) {
      const object = a.object;
      object.position.x = a.x + pointerX * o.depth * .025;
      object.position.y = a.y + pointerY * o.depth * .017 + Math.sin(this.time * .27 + a.phase) * .008;
      object.rotation.x = a.rx + Math.sin(this.time * .14 + a.phase) * .035;
      object.rotation.y = a.ry + (a.type === 'gem' ? this.time * .065 : Math.sin(this.time * .1) * .06);
      object.rotation.z = a.rz + Math.sin(this.time * .12 + a.phase) * .055;
    }
  }

  _render() {
    if (this.disposed) return;
    if (this.renderer) { this._prepareFrame(this.height * this.dpr); this.renderer.render(this.scene, this.camera); }
    else if (this.context) this._drawFallback(this.context, (this.fallbackCanvas || this.canvas).width, (this.fallbackCanvas || this.canvas).height);
  }

  _makeFallbackSprites(color) {
    this.fallbackSprites = [false, true].map(star => {
      const sprite = document.createElement('canvas'); sprite.width = 128; sprite.height = 128;
      const ctx = sprite.getContext('2d');
      const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      glow.addColorStop(0, '#fff8ef'); glow.addColorStop(.13, color || '#b899ff'); glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
      if (star) {
        const x = 64, y = 64, size = 25;
        ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .09, y - size * .1); ctx.lineTo(x + size * .8, y); ctx.lineTo(x + size * .09, y + size * .1); ctx.lineTo(x, y + size); ctx.lineTo(x - size * .09, y + size * .1); ctx.lineTo(x - size * .8, y); ctx.lineTo(x - size * .09, y - size * .1); ctx.closePath(); ctx.fillStyle = '#fffbef'; ctx.fill();
      }
      return sprite;
    });
  }

  _drawFallback(ctx, width, height) {
    const o = this.options, image = this.image;
    ctx.save(); ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#0b0712'; ctx.fillRect(0, 0, width, height);
    if (image) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * (1.035 + (this.design?.variant % 3 || 0) * .006);
      const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
      const px = o.motion ? this.smoothPointer.x * o.depth * width * .008 : 0, py = o.motion ? this.smoothPointer.y * o.depth * height * .005 : 0;
      ctx.filter = `brightness(${o.brightness})`; ctx.drawImage(image, (width - iw) / 2 + px, (height - ih) / 2 + py, iw, ih); ctx.filter = 'none';
    }
    let vignette = this.fallbackVignettes.get(ctx);
    if (!vignette || vignette.width !== width || vignette.height !== height) {
      const gradient = ctx.createRadialGradient(width * .5, height * .48, width * .25, width * .5, height * .48, height * .67);
      gradient.addColorStop(0, 'rgba(6,3,15,0)'); gradient.addColorStop(1, 'rgba(6,3,15,.27)');
      vignette = { width, height, gradient }; this.fallbackVignettes.set(ctx, vignette);
    }
    ctx.fillStyle = vignette.gradient; ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'screen';
    if (this.fallbackSprites && o.sparkle > 0) for (const particle of this.fallbackParticles) {
      const x = (particle.x + Math.sin(this.time * .105 + particle.phase) * .008) * width;
      const y = (particle.y + Math.sin(this.time * .15 + particle.phase) * .009) * height;
      const radius = particle.size * height / 1800 * 2.6;
      ctx.globalAlpha = o.sparkle * (.25 + .75 * Math.pow(.5 + .5 * Math.sin(this.time * .7 + particle.phase), 2));
      ctx.drawImage(this.fallbackSprites[particle.star ? 1 : 0], x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  async renderStill(width = 1080, height = 2424) {
    if (this.disposed) throw new Error('表示は終了しています。');
    width = Math.round(Number(width)); height = Math.round(Number(height));
    if (!(width > 0 && height > 0 && width <= 4096 && height <= 4096)) throw new Error('保存サイズが範囲外です。');
    if (!this.image) throw new Error('背景画像の読み込み後に保存してください。');
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const ctx = output.getContext('2d');
    if (!this.renderer) { this._drawFallback(ctx, width, height); return blobFromCanvas(output); }
    const target = new THREE.WebGLRenderTarget(width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const previousTarget = this.renderer.getRenderTarget();
    const camera = new THREE.OrthographicCamera(-width / height, width / height, 1, -1, .1, 30); camera.position.z = 10;
    try {
      this._updateCover(width / height); this._prepareFrame(height);
      this.renderer.setRenderTarget(target); this.renderer.render(this.scene, camera);
      const pixels = new Uint8Array(width * height * 4); this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const imageData = ctx.createImageData(width, height), rowLength = width * 4;
      for (let y = 0; y < height; y++) imageData.data.set(pixels.subarray((height - y - 1) * rowLength, (height - y) * rowLength), y * rowLength);
      ctx.putImageData(imageData, 0, 0);
    } finally {
      this.renderer.setRenderTarget(previousTarget); target.dispose(); this._updateCover(this.width / this.height); this._render();
    }
    return blobFromCanvas(output);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true; ++this.loadToken; this._stop();
    document.removeEventListener('visibilitychange', this._visibility);
    this.canvas.removeEventListener('webglcontextlost', this._contextLost);
    this._resizeObserver.disconnect(); this._disposeDecorations();
    if (this.texture) this.texture.dispose();
    this.backdrop?.geometry.dispose(); this.backgroundMaterial?.dispose();
    this.renderer?.dispose(); this.fallbackCanvas?.remove();
    if (this.fallbackCanvas) this.canvas.style.opacity = this._originalCanvasOpacity || '';
    this.image = null;
  }
}
