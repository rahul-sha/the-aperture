'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { findPhoto, photoSrc, thumbSrc } from '../lib/photos';

// The whole page is one walk through a dark space, drawn with three.js.
// It opens on the intro collage: nine cards fly in from the dark and settle.
// Scrolling (or the drift, which scrolls for you) moves the camera forward,
// first through the collage, then past every photo, one section at a time.
//
// Distances are in scene units. The camera starts at z = 0 and looks down
// the negative z axis; each unit of depth is PX_PER_UNIT of page scroll.

const COLLAGE_Z = -6; // the collage hangs this far in front of the camera
const START = -19; // where the first section begins
const GAP = 3.2; // between photos in a section
const PAUSE = 7; // extra space between sections
const PHOTO_RADIUS = 0.055; // corner radius of every photo, in scene units
const DRIFT_SPEED = 0.3; // units per second while drifting
const DRIFT_RESUME = 4000; // ms to wait after you scroll before drifting again
const FLY_DONE = 2.6; // seconds until the intro fly-in has settled
const CARD_Z = -10; // where the camera rests on the welcome
const GLIDE = 2.4; // seconds for the glide from the collage to the welcome
const WELCOME_EASE = 0.8; // seconds the welcome words take to settle in or out
const TITLE_LEAD = 6.5; // a section's name appears this far before its first photo
const FAR = 22; // photos further than this have faded into the dark

// Where each of the nine collage cards sits, in the same pixel units as the
// old CSS intro: width, height, offset from the centre, and stacking order.
const SLOTS = [
  [300, 430, 0, 0, 9],
  [150, 104, -10, -262, 2],
  [200, 196, -236, -118, 3],
  [132, 150, -162, 26, 5],
  [214, 186, -228, 196, 4],
  [124, 176, 210, -170, 3],
  [220, 160, 264, 30, 4],
  [150, 204, 216, 226, 5],
  [160, 108, -8, 262, 2],
];

// A rounded-corner photo that fades into the dark with distance.
const vertexShader = `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const fragmentShader = `
  uniform sampler2D map;
  uniform float ready;
  uniform float opacity;
  uniform vec2 size;
  uniform float radius;
  uniform float far;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 p = (vUv - 0.5) * size;
    vec2 q = abs(p) - (size * 0.5 - radius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float aa = fwidth(d);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    vec3 col = mix(vec3(0.008), texture2D(map, vUv).rgb, ready);
    col *= 1.0 - smoothstep(far * 0.3, far, vDepth);
    gl_FragColor = vec4(col, inside * opacity);
    #include <colorspace_fragment>
  }`;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - t) ** 4;
const rnd = (i) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };

export default function Walk({ manifest, drift, paused, replayKey, railRef, controlRef, onOpen, onGo }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const ui = useRef({});
  // Read live by the frame loop, so changing them never rebuilds the scene.
  const live = useRef({});
  live.current = { drift, paused, onOpen, onGo };
  const ownApi = useRef(null);
  const api = controlRef || ownApi; // the page can steer the walk through this

  const { about } = manifest;
  const sections = manifest.sections.filter((s) => s.photos.length);
  // The closing quote, split from its author so each can be set on its own line.
  const words = about.quote ? (() => {
    const m = about.quote.match(/^\s*["“]?(.+?)["”]?\s+[—–-]\s+(.+)$/);
    return m ? { text: `“${m[1]}”`, by: m[2] } : { text: about.quote };
  })() : null;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Photos on R2 are fetched through this site (see next.config.mjs), so
    // WebGL is allowed to read them.
    const tex = (url) => (manifest.texBase ? url.replace(manifest.base, manifest.texBase) : url);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
    const loader = new THREE.TextureLoader();
    const blank = new THREE.Texture();

    function makePhoto(photo, w, h) {
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        uniforms: {
          map: { value: blank },
          ready: { value: 0 },
          opacity: { value: 1 },
          size: { value: new THREE.Vector2(w, h) },
          radius: { value: PHOTO_RADIUS },
          far: { value: FAR },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.scale.set(w, h, 1);
      mesh.userData = { photo, quality: 0 };
      return mesh;
    }
    // Small copies first; the full-size file once the photo is close.
    let heroLoaded = 0;
    function load(mesh, quality) {
      if (mesh.userData.quality >= quality) return;
      mesh.userData.quality = quality;
      const p = mesh.userData.photo;
      loader.load(tex(quality === 1 ? thumbSrc(manifest, p) : photoSrc(manifest, p)), (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        const old = mesh.material.uniforms.map.value;
        mesh.material.uniforms.map.value = t;
        mesh.material.uniforms.ready.value = 1;
        if (mesh.userData.card != null && quality === 1) heroLoaded += 1;
        if (old !== blank) old.dispose();
      });
    }

    // The collage.
    const introPhotos = manifest.intro.map((id) => findPhoto(manifest, id)).filter(Boolean).slice(0, SLOTS.length);
    const cards = introPhotos.map((photo, i) => {
      const mesh = makePhoto(photo, 1, 1);
      mesh.userData.list = introPhotos;
      mesh.userData.index = i;
      mesh.userData.card = i;
      scene.add(mesh);
      load(mesh, 1);
      return mesh;
    });

    // The corridor: every photo in section order, alternating sides, with a
    // pause before each new section.
    const marks = [];
    let z = START;
    const items = [];
    sections.forEach((s, si) => {
      if (si) z -= PAUSE;
      marks.push({ slug: s.slug, name: s.name, quote: s.quote, z });
      s.photos.forEach((photo, j) => {
        const n = items.length;
        const side = n % 2 ? 1 : -1;
        const h = photo.h >= photo.w ? 1.9 : 1.4;
        const w = h * ((photo.w || 3) / (photo.h || 2));
        const mesh = makePhoto(photo, w, h);
        mesh.position.set(0, (rnd(n + 7) - 0.5) * 1.6, z);
        mesh.userData.list = s.photos;
        mesh.userData.index = j;
        mesh.userData.side = side;
        mesh.userData.drift = rnd(n);
        mesh.userData.full = [w, h];
        scene.add(mesh);
        items.push(mesh);
        z -= GAP;
      });
    });
    const END = z - 6;
    const photos = [...cards, ...items];

    // A faint dust of points, so the space reads as deep between photos.
    {
      const g = new THREE.BufferGeometry();
      const n = 1200;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 1) {
        pos[i * 3] = (rnd(i) - 0.5) * 16;
        pos[i * 3 + 1] = (rnd(i + 3) - 0.5) * 9;
        pos[i * 3 + 2] = 4 + rnd(i + 5) * (END - 4);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf4b6c2, size: 0.018, transparent: true, opacity: 0.5 })));
    }

    // Layout: the page is as tall as the walk is deep.
    let pxPerUnit = 300;
    let k = 0.01; // scene units per collage pixel
    function layout() {
      const w = root.clientWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 640 ? 70 : 55;
      camera.updateProjectionMatrix();
      pxPerUnit = h * 0.14; // about half a screen of scrolling from one photo to the next
      root.style.height = `${Math.round(h + -END * pxPerUnit)}px`;
      // Fit the collage to the screen the way the old intro did.
      const visH = 2 * -COLLAGE_Z * Math.tan((camera.fov * Math.PI) / 360);
      const visW = visH * camera.aspect;
      // On a phone the outer cards may run off the sides, as they did before.
      k = Math.min((0.86 * visH) / 680, ((w < 640 ? 1.25 : 0.96) * visW) / 820);
      // The corridor: on a narrow screen the photos come in closer to the
      // middle and a little smaller, so each one fits on screen as it passes.
      const narrow = w < 640;
      items.forEach((mesh) => {
        const { side, drift: r, full } = mesh.userData;
        const sc = narrow ? 0.62 : 1;
        mesh.position.x = side * (narrow ? 0.42 + r * 0.3 : 1.5 + r * 1.3);
        mesh.rotation.y = -side * (narrow ? 0.12 : 0.22);
        mesh.material.uniforms.size.value.set(full[0] * sc, full[1] * sc);
        mesh.scale.set(full[0] * sc, full[1] * sc, 1);
      });
      cards.forEach((mesh, i) => {
        const [sw, sh, x, y, zi] = SLOTS[i];
        const p = mesh.userData.photo;
        const ratio = p.w && p.h ? p.w / p.h : sw / sh;
        const cw = Math.sqrt(sw * sh * ratio) * k;
        const ch = Math.sqrt((sw * sh) / ratio) * k;
        mesh.scale.set(cw, ch, 1);
        mesh.material.uniforms.size.value.set(cw, ch);
        mesh.userData.base = new THREE.Vector3(x * k, -y * k, COLLAGE_Z + (zi - 5) * 0.08);
      });
    }
    layout();
    window.addEventListener('resize', layout);

    // Overlays and the rail, updated straight from the frame loop.
    const { threshold, title, titleName, titleQuote, exit, cue, veil, caption } = ui.current;
    const rail = railRef?.current;

    // Hover and click.
    const mouse = new THREE.Vector2(9, 9);
    const look = { x: 0, y: 0 };
    const ray = new THREE.Raycaster();
    let hover = null;
    let downAt = null;
    let welcomeUp = false; // photos behind the welcome can't be picked
    let welcomeOp = 0; // eased behind the scroll, so the words arrive slowly

    const onMove = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; };
    const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; onMove(e); };
    const onUp = (e) => {
      if (welcomeUp || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
      onMove(e);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(photos).find((h) => h.object.material.uniforms.opacity.value > 0.5);
      if (hit) live.current.onOpen(hit.object.userData.list, hit.object.userData.index);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    // The page rests on the collage after it loads. The first scroll down
    // glides you to the welcome; the next one (or its arrow) glides on to the
    // first section and starts the drift. The drift scrolls the page for you,
    // and anything you do to scroll pauses it for a few seconds, then it
    // carries on from wherever you are.
    // The collage waits for its nine photos (or three seconds at most), so the
    // cards fly in whole; everything else loads only once they have.
    let flyStart = null;
    const flyDeadline = performance.now() + 3000;
    let pausedUntil = 0;
    let expected = null;
    let acc = 0;
    let looping = false;
    let glide = null; // { from, to, start }
    let quietUntil = 0; // trackpads keep sending a little scroll after a glide
    let touchY = null;
    const yAt = (zz) => Math.round(root.offsetTop - zz * pxPerUnit);
    const cardY = () => yAt(CARD_Z);
    const startY = () => yAt(START + TITLE_LEAD - 0.5);
    const onHero = () => window.scrollY < cardY() - 4;
    const atWelcome = () => !onHero() && window.scrollY < startY() - 4;
    const pause = () => { pausedUntil = performance.now() + DRIFT_RESUME; expected = null; };
    function glideTo(to) {
      if (glide) return;
      glide = { from: window.scrollY, to, start: performance.now() };
    }
    const begin = () => { live.current.onGo?.(); glideTo(startY()); };
    // A push down from the collage or the welcome takes you to the next step.
    // Returns true when it did, so the browser's own scroll is held back.
    function step() {
      if (glide || performance.now() < quietUntil) return true;
      if (live.current.drift) return false;
      if (onHero()) { glideTo(cardY()); return true; }
      if (atWelcome()) { begin(); return true; }
      return false;
    }
    const onWheel = (e) => {
      if (glide || performance.now() < quietUntil || (e.deltaY > 0 && step())) { e.preventDefault(); return; }
      pause();
    };
    const onTouchStart = (e) => { touchY = e.touches[0]?.clientY ?? null; pause(); };
    const onTouchMove = (e) => {
      const y = e.touches[0]?.clientY;
      if (glide || (touchY != null && y != null && touchY - y > 8 && step())) e.preventDefault();
    };
    const onKey = (e) => {
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) return;
      if (e.target instanceof Element && e.target.closest('button, a, input, [role="slider"]')) return;
      if (glide || (['ArrowDown', 'PageDown', ' '].includes(e.key) && step())) { e.preventDefault(); return; }
      pause();
    };
    const onScroll = () => { if (expected !== null && Math.abs(window.scrollY - expected) > 2) pause(); };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });

    // The timeline along the top: one segment per section, a tick per photo,
    // and a marker for where you are. Click or drag along it to move.
    const zFrom = START + TITLE_LEAD;
    const zTo = items.length ? items[items.length - 1].position.z : END;
    const uOf = (zz) => clamp01((zFrom - zz) / (zFrom - zTo));
    const segs = rail ? [...rail.querySelectorAll('.walk__seg')] : [];
    const ticks = rail?.querySelector('.walk__ticks');
    const head = rail?.querySelector('.walk__head');
    const track = rail?.querySelector('.walk__track');
    const slider = rail?.querySelector('.walk__slider');
    segs.forEach((el, i) => {
      const a = uOf(marks[i].z + TITLE_LEAD);
      const b = i + 1 < marks.length ? uOf(marks[i + 1].z + TITLE_LEAD) : 1;
      el.style.flex = `${Math.max(0.001, b - a)} 1 0px`;
    });
    if (ticks) {
      ticks.innerHTML = '';
      items.forEach((m) => {
        const t = document.createElement('i');
        t.style.left = `${(uOf(m.position.z) * 100).toFixed(2)}%`;
        ticks.appendChild(t);
      });
    }
    // A soft mechanical click (and on a phone, a tiny vibration) each time
    // the scrub passes a photo, like turning a dial on a camera. The sound is made in the browser, and only
    // after you touch the timeline (browsers allow audio after a gesture).
    let audio = null;
    let clickBuf = null;
    let lastTick = -1;
    let lastClickAt = 0;
    // Browsers hold back sound and vibration until the visitor has tapped or
    // clicked something. On a phone a drag doesn't count, only a tap, so the
    // sound is woken up on the first tap or click anywhere on the page.
    function wakeAudio() {
      try {
        if (!audio) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          audio = new AC();
          const len = Math.round(audio.sampleRate * 0.03);
          clickBuf = audio.createBuffer(1, len, audio.sampleRate);
          const d = clickBuf.getChannelData(0);
          for (let i = 0; i < len; i += 1) {
            const t = i / audio.sampleRate;
            d[i] = ((Math.random() * 2 - 1) * Math.exp(-t * 520) + Math.sin(2 * Math.PI * 2300 * t) * Math.exp(-t * 900) * 0.6) * 0.5;
          }
        }
        if (audio.state === 'suspended') audio.resume();
      } catch { /* no sound is fine */ }
    }
    window.addEventListener('pointerup', wakeAudio);
    window.addEventListener('keydown', wakeAudio);
    function click() {
      const t0 = performance.now();
      if (t0 - lastClickAt < 28) return; // a fast drag shouldn't buzz
      lastClickAt = t0;
      // On phones that allow it (Android, not iPhone), a short tap of vibration too.
      try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12); } catch { /* fine without */ }
      try {
        wakeAudio();
        if (!audio || audio.state !== 'running') return;
        const src = audio.createBufferSource();
        src.buffer = clickBuf;
        src.playbackRate.value = 0.92 + Math.random() * 0.16;
        const filter = audio.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 900;
        const gain = audio.createGain();
        gain.gain.value = 0.35;
        src.connect(filter).connect(gain).connect(audio.destination);
        src.start();
      } catch { /* no sound is fine */ }
    }
    const tickAt = (u) => items.reduce((n, m) => n + (uOf(m.position.z) <= u + 1e-4 ? 1 : 0), 0);
    const seekTo = (u) => {
      const t = tickAt(clamp01(u));
      if (t !== lastTick) { if (lastTick !== -1) click(); lastTick = t; }
      const zz = zFrom - clamp01(u) * (zFrom - zTo);
      glide = null;
      expected = null;
      window.scrollTo({ top: Math.round(root.offsetTop - zz * pxPerUnit), behavior: 'instant' });
    };
    let scrubbing = false;
    const uAt = (e) => { const r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    const onScrubDown = (e) => {
      if (!track || e.button > 0) return;
      scrubbing = true;
      slider.setPointerCapture(e.pointerId);
      rail.classList.add('is-scrubbing');
      lastTick = tickAt(uOf(camZ));
      pause();
      seekTo(uAt(e));
    };
    const onScrubMove = (e) => { if (scrubbing) { pause(); seekTo(uAt(e)); } };
    const onScrubUp = () => { scrubbing = false; rail?.classList.remove('is-scrubbing'); pause(); };
    const onScrubKey = (e) => {
      const step = { ArrowRight: GAP, ArrowLeft: -GAP }[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      pause();
      lastTick = tickAt(uOf(camZ));
      seekTo(uOf(camZ - step));
    };
    if (rail) {
      slider.addEventListener('pointerdown', onScrubDown);
      slider.addEventListener('pointermove', onScrubMove);
      slider.addEventListener('pointerup', onScrubUp);
      slider.addEventListener('pointercancel', onScrubUp);
      slider.addEventListener('keydown', onScrubKey);
    }

    let camZ = -window.scrollY / pxPerUnit;
    function replay(top) {
      expected = null;
      window.scrollTo({ top: 0, behavior: 'instant' });
      camZ = 0;
      flyStart = performance.now() / 1000;
      glide = null;
      pausedUntil = performance.now() + FLY_DONE * 1000 + (top ? 0 : 1000);
    }
    // At the end of the walk, rest on the last screen, then fade to black and
    // start again from the collage.
    function loopToStart() {
      looping = true;
      setTimeout(() => {
        if (veil) veil.style.opacity = '1';
        setTimeout(() => {
          replay(false);
          if (veil) veil.style.opacity = '0';
          looping = false;
        }, 900);
      }, 6000);
    }
    api.current = {
      replay: () => replay(true),
      // Turning the drift on from the collage or the welcome first glides to
      // the first section.
      go: () => { pausedUntil = 0; if (window.scrollY < startY() - 4) glideTo(startY()); },
      toCard: () => glideTo(cardY()),
      begin,
      // Straight to the closing words and links: a quick fade through black
      // instead of rushing past every photo.
      toEnd: () => {
        pause();
        glide = null;
        if (veil) { veil.style.transition = 'opacity .4s ease'; veil.style.opacity = '1'; }
        setTimeout(() => {
          const top = root.offsetTop + root.offsetHeight - window.innerHeight;
          window.scrollTo({ top, behavior: 'instant' });
          camZ = -Math.max(0, top - root.offsetTop) / pxPerUnit;
          pause();
          if (veil) veil.style.opacity = '0';
          setTimeout(() => { if (veil) veil.style.transition = ''; }, 500);
        }, reduced ? 0 : 450);
      },
    };

    let current = null;
    let last = performance.now();
    let raf = 0;
    function frame(nowMs) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const now = nowMs / 1000;
      const maxScroll = root.offsetTop + root.offsetHeight - window.innerHeight;

      // The glide from the collage to the card: eased, so it starts and
      // lands softly.
      if (glide) {
        const t = clamp01((nowMs - glide.start) / (reduced ? 1 : GLIDE * 1000));
        const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        expected = Math.round(glide.from + (glide.to - glide.from) * e);
        window.scrollTo({ top: expected, behavior: 'instant' });
        if (t >= 1) { glide = null; acc = expected; quietUntil = nowMs + 700; }
      }

      // Drift.
      const { drift: driftOn, paused: held } = live.current;
      if (glide) {
        // the glide is moving the page
      } else if (driftOn && !held && !looping && nowMs > pausedUntil && document.visibilityState === 'visible') {
        if (expected === null) acc = window.scrollY;
        acc += DRIFT_SPEED * pxPerUnit * dt;
        if (acc >= maxScroll - 1) {
          expected = null;
          loopToStart();
        } else {
          expected = Math.round(acc);
          window.scrollTo({ top: expected, behavior: 'instant' });
        }
      } else {
        expected = null;
      }

      const target = -Math.max(0, window.scrollY - root.offsetTop) / pxPerUnit;
      camZ += (target - camZ) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
      const mx = mouse.x > 1 ? 0 : mouse.x;
      const my = mouse.y > 1 ? 0 : mouse.y;
      look.x += (mx * 0.5 - look.x) * 0.05;
      look.y += (my * 0.3 - look.y) * 0.05;
      camera.position.set(look.x, look.y, camZ);
      camera.lookAt(look.x * 0.4, look.y * 0.4, camZ - 10);

      if (flyStart == null && (heroLoaded >= cards.length || nowMs > flyDeadline)) flyStart = now;
      const heroIn = flyStart != null && now - flyStart > 1.2;

      // The collage: fly in, float, then part gently as you walk into it.
      const part = smooth(0, -COLLAGE_Z, -camZ);
      cards.forEach((mesh, i) => {
        const b = mesh.userData.base;
        const delay = i === 0 ? 0.2 : 0.35 + i * 0.12;
        const t = flyStart == null ? 0 : reduced ? 1 : easeOut(clamp01((now - flyStart - delay) / 1.6));
        const fx = (i % 2 ? 1 : -1) * (400 + i * 40) * k;
        const fy = ((i % 3) - 1) * 260 * k;
        const f = reduced || flyStart == null ? 0 : now - flyStart;
        const floatX = Math.sin(f / (4.2 + (i % 4) * 0.9) + i) * (6 + (i % 3) * 4) * k;
        const floatY = Math.cos(f / (5 + (i % 3)) + i * 2) * (8 + (i % 4) * 3) * k;
        const spread = 1 + part * part * 0.9;
        mesh.position.set(
          (b.x + floatX * t) * spread + fx * (1 - t),
          (b.y + floatY * t) * spread - fy * (1 - t),
          b.z - 18 * (1 - t),
        );
        mesh.rotation.set(((i % 3) - 1) * 0.52 * (1 - t), (i % 2 ? -1 : 1) * 1.22 * (1 - t), Math.sin(f / 6 + i) * 0.012 * t);
        const d = camZ - mesh.position.z;
        // The big middle card would fill the screen, so it fades a little sooner.
        mesh.material.uniforms.opacity.value = t * (i === 0 ? smooth(1.4, 3.2, d) : smooth(0.5, 2.2, d));
      });

      // The corridor: each photo arrives out of the dark and fades as you pass.
      items.forEach((mesh) => {
        const d = camZ - mesh.position.z;
        // Kept out of sight behind the collage until you start walking.
        mesh.material.uniforms.opacity.value = smooth(0, 0.7, d) * smooth(0.5, 3, -camZ);
        if (!heroIn) return;
        if (d > -2 && d < FAR) load(mesh, 1);
        if (d > 0 && d < 10) load(mesh, 2);
      });

      ray.setFromCamera(mouse, camera);
      const hit = mouse.x <= 1 && !welcomeUp ? ray.intersectObjects(photos).find((h) => h.object.material.uniforms.opacity.value > 0.5) : null;
      hover = hit ? hit.object : null;
      canvas.style.cursor = hover ? 'pointer' : '';
      if (hover) document.documentElement.dataset.focus = ''; else delete document.documentElement.dataset.focus;
      photos.forEach((mesh) => {
        const s = mesh === hover ? 1.05 : 1;
        mesh.userData.hover = (mesh.userData.hover || 1) + (s - (mesh.userData.hover || 1)) * 0.15;
        const { size } = mesh.material.uniforms;
        mesh.scale.set(size.value.x * mesh.userData.hover, size.value.y * mesh.userData.hover, 1);
      });
      if (caption) {
        // The collage stays wordless; names show only along the walk.
        if (hover && hover.userData.card == null) {
          const p = hover.userData.photo;
          caption.firstChild.textContent = p.title;
          caption.lastChild.textContent = p.place || '';
          caption.style.opacity = '1';
        } else caption.style.opacity = '0';
      }

      // Which section are we walking through?
      let now2 = null;
      marks.forEach((mk) => { if (camZ < mk.z + TITLE_LEAD) now2 = mk; });
      if (now2 !== current && title) {
        current = now2;
        title.classList.add('is-out');
        window.setTimeout(() => {
          if (current) {
            titleName.textContent = current.name;
            titleQuote.textContent = current.quote || '';
            title.classList.remove('is-out');
          }
        }, 450);
        segs.forEach((el, i) => el.setAttribute('aria-current', String(marks[i] === current)));
      }
      const tz = -camZ;
      if (threshold) {
        const goal = smooth(6.8, 8.8, tz) * (1 - smooth(10.6, 11.9, tz));
        welcomeOp += (goal - welcomeOp) * (reduced ? 1 : 1 - Math.exp(-dt / WELCOME_EASE));
        const op = Math.abs(goal - welcomeOp) < 0.002 ? goal : welcomeOp;
        welcomeUp = op > 0.3 || (exit && +exit.style.opacity > 0.3);
        threshold.style.opacity = op.toFixed(3);
        // The words come out of the middle of the screen as if from the
        // depth ahead, and grow past you as you walk on.
        const sc = tz > -CARD_Z ? 1 + (1 - op) * 0.25 : 0.6 + op * 0.4;
        threshold.firstChild.style.transform = `scale(${sc.toFixed(3)})`;
        threshold.style.visibility = op > 0.02 ? 'visible' : 'hidden';
      }
      if (cue) cue.style.opacity = (1 - smooth(0, 0.8, tz)).toFixed(3);
      if (rail) {
        const op = smooth(-START - TITLE_LEAD - 1.2, -START - TITLE_LEAD, tz);
        rail.style.opacity = op.toFixed(3);
        rail.style.visibility = op > 0.02 ? 'visible' : 'hidden';
        const u = uOf(camZ);
        if (head) head.style.left = `${(u * 100).toFixed(2)}%`;
        slider.setAttribute('aria-valuenow', String(Math.round(u * 100)));
      }
      if (exit) {
        const ex = smooth(-END - 8, -END - 3, tz);
        exit.style.opacity = ex.toFixed(3);
        exit.firstChild.style.transform = `scale(${(0.6 + ex * 0.4).toFixed(3)})`;
        exit.style.visibility = ex > 0.02 ? 'visible' : 'hidden';
        if (title) title.style.visibility = ex > 0.5 ? 'hidden' : 'visible';
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      if (rail) {
        slider.removeEventListener('pointerdown', onScrubDown);
        slider.removeEventListener('pointermove', onScrubMove);
        slider.removeEventListener('pointerup', onScrubUp);
        slider.removeEventListener('pointercancel', onScrubUp);
        slider.removeEventListener('keydown', onScrubKey);
      }
      window.removeEventListener('pointerup', wakeAudio);
      window.removeEventListener('keydown', wakeAudio);
      audio?.close();
      delete document.documentElement.dataset.focus;
      photos.forEach((m) => { m.material.uniforms.map.value.dispose(); m.material.dispose(); m.geometry.dispose(); });
      renderer.dispose();
    };
    // The scene is built once per manifest; drift, pause, and onOpen are read live.
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (replayKey && api.current) api.current.replay();
  }, [replayKey]);

  // Turning the drift on (from the welcome or the header switch) starts it now.
  useEffect(() => {
    if (drift && api.current) api.current.go();
  }, [drift]);

  const set = (key) => (el) => { ui.current[key] = el; };
  return (
    <section ref={rootRef} className="walk" aria-label="Every photo, one after another">
      <div className="walk__view">
        <canvas ref={canvasRef} className="walk__canvas" aria-label="Photos floating in a dark space. Click one to open it." />

        <div ref={set('cue')} className="walk__cue">
          <button type="button" onClick={() => api.current?.toCard()} aria-label="Continue">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>

        <div ref={set('threshold')} className="walk__threshold" style={{ opacity: 0, visibility: 'hidden' }}>
          <div className="walk__welcome">
            <p className="walk__by">Photographs by {[about.name, about.city].filter(Boolean).join(', ')}</p>
            <h1>{about.welcome || 'Welcome to The Aperture'}</h1>
            <p className="walk__line serif">{about.welcomeLine || 'Here lies my collection.'}</p>
            {about.headline && <p className="walk__sub">{about.headline}</p>}
            <button type="button" className="walk__next" onClick={() => api.current?.begin()} aria-label="Begin the walk">
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>
        </div>

        <div ref={(el) => { ui.current.title = el; ui.current.titleName = el?.firstChild; ui.current.titleQuote = el?.lastChild; }} className="walk__title is-out" aria-live="polite">
          <span className="walk__name serif" />
          <span className="walk__quote" />
        </div>

        <div ref={(el) => { ui.current.caption = el; }} className="walk__caption" style={{ opacity: 0 }} aria-hidden="true">
          <span className="walk__cap-title" />
          <span className="place" />
        </div>

        <div ref={set('exit')} className="walk__exit" style={{ opacity: 0, visibility: 'hidden' }}>
          <div className="walk__welcome">
            <p className="walk__by">The end of the walk</p>
            {words && <p className="walk__big serif">{words.text}</p>}
            {words?.by && <p className="walk__line serif">{words.by}</p>}
            {about.bio && <p className="walk__sub">{about.bio}</p>}
            {about.now && <p className="walk__sub"><span className="walk__now">Now:</span> {about.now}</p>}
            <div className="walk__links">
              {about.instagram && <a href={about.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {about.bluesky && <a href={about.bluesky} target="_blank" rel="noopener noreferrer">Bluesky</a>}
              {about.projectsUrl && <a href={about.projectsUrl} target="_blank" rel="noopener noreferrer">Other projects</a>}
              {about.email && <a href={`mailto:${about.email}`}>Email me</a>}
            </div>
            <button type="button" className="walk__next" onClick={() => api.current?.replay()} aria-label="Back to the start" title="Back to the start">
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            </button>
          </div>
        </div>

        <div ref={set('veil')} className="walk__veil" aria-hidden="true" />
      </div>
    </section>
  );
}

// The timeline in the header: one segment per section, a tick per photo,
// and a marker for where you are. Walk wires it up through railRef. On a
// phone it runs along the bottom with a way home at its start.
export function Timeline({ manifest, railRef, onHome }) {
  const sections = manifest.sections.filter((s) => s.photos.length);
  return (
    <div ref={railRef} className="walk__timeline" style={{ opacity: 0, visibility: 'hidden' }}>
      {onHome && (
        <button type="button" className="walk__home" onClick={onHome} aria-label="Back to the start" title="Back to the start">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        </button>
      )}
      <div
        className="walk__slider"
        role="slider"
        tabIndex={0}
        aria-label="Timeline of every photo. Drag, or use the left and right arrow keys."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <div className="walk__track">
          {sections.map((s) => (
            <div key={s.slug} className="walk__seg"><span>{s.name}</span></div>
          ))}
          <div className="walk__ticks" aria-hidden="true" />
          <div className="walk__head" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
