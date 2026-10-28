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
const START = -15; // where the first section begins
const GAP = 3.2; // between photos in a section
const PAUSE = 7; // extra space between sections
const PHOTO_RADIUS = 0.055; // corner radius of every photo, in scene units
const DRIFT_SPEED = 0.3; // units per second while drifting
const DRIFT_RESUME = 4000; // ms to wait after you scroll before drifting again
const FLY_DONE = 2.6; // seconds until the intro fly-in has settled
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

export default function Walk({ manifest, drift, paused, replayKey, onOpen }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const ui = useRef({});
  // Read live by the frame loop, so changing them never rebuilds the scene.
  const live = useRef({});
  live.current = { drift, paused, onOpen };
  const api = useRef(null);

  const { about } = manifest;
  const sections = manifest.sections.filter((s) => s.photos.length);

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
        mesh.position.set(side * (1.5 + rnd(n) * 1.3), (rnd(n + 7) - 0.5) * 1.6, z);
        mesh.rotation.y = -side * 0.22;
        mesh.userData.list = s.photos;
        mesh.userData.index = j;
        mesh.userData.base = mesh.position.clone();
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
      pxPerUnit = h * 0.34;
      root.style.height = `${Math.round(h + -END * pxPerUnit)}px`;
      // Fit the collage to the screen the way the old intro did.
      const visH = 2 * -COLLAGE_Z * Math.tan((camera.fov * Math.PI) / 360);
      const visW = visH * camera.aspect;
      // On a phone the outer cards may run off the sides, as they did before.
      k = Math.min((0.86 * visH) / 680, ((w < 640 ? 1.25 : 0.96) * visW) / 820);
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
    const { threshold, title, titleName, titleQuote, exit, cue, veil, caption, rail } = ui.current;
    const railButtons = rail ? [...rail.querySelectorAll('button')] : [];
    railButtons.forEach((b, i) => {
      b.onclick = () => window.scrollTo({ top: Math.max(0, (-marks[i].z - 2) * pxPerUnit), behavior: 'smooth' });
    });

    // Hover and click.
    const mouse = new THREE.Vector2(9, 9);
    const look = { x: 0, y: 0 };
    const ray = new THREE.Raycaster();
    let hover = null;
    let downAt = null;
    const onMove = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; };
    const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; onMove(e); };
    const onUp = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
      onMove(e);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(photos).find((h) => h.object.material.uniforms.opacity.value > 0.5);
      if (hit) live.current.onOpen(hit.object.userData.list, hit.object.userData.index);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    // The drift scrolls the page for you. Anything you do to scroll pauses it
    // for a few seconds, then it carries on from wherever you are.
    let flyStart = performance.now() / 1000;
    let pausedUntil = performance.now() + FLY_DONE * 1000;
    let expected = null;
    let acc = 0;
    let looping = false;
    const pause = () => { pausedUntil = performance.now() + DRIFT_RESUME; expected = null; };
    const onKey = (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) pause(); };
    const onScroll = () => { if (expected !== null && Math.abs(window.scrollY - expected) > 2) pause(); };
    window.addEventListener('wheel', pause, { passive: true });
    window.addEventListener('touchstart', pause, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });

    let camZ = -window.scrollY / pxPerUnit;
    function replay(top) {
      expected = null;
      window.scrollTo({ top: 0, behavior: 'instant' });
      camZ = 0;
      flyStart = performance.now() / 1000;
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
    api.current = { replay: () => replay(true) };

    let current = null;
    let last = performance.now();
    let raf = 0;
    function frame(nowMs) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const now = nowMs / 1000;
      const maxScroll = root.offsetTop + root.offsetHeight - window.innerHeight;

      // Drift.
      const { drift: driftOn, paused: held } = live.current;
      if (driftOn && !held && !looping && nowMs > pausedUntil && document.visibilityState === 'visible') {
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

      // The collage: fly in, float, then part gently as you walk into it.
      const part = smooth(0, -COLLAGE_Z, -camZ);
      cards.forEach((mesh, i) => {
        const b = mesh.userData.base;
        const delay = i === 0 ? 0.2 : 0.35 + i * 0.12;
        const t = reduced ? 1 : easeOut(clamp01((now - flyStart - delay) / 1.6));
        const fx = (i % 2 ? 1 : -1) * (400 + i * 40) * k;
        const fy = ((i % 3) - 1) * 260 * k;
        const f = reduced ? 0 : now - flyStart;
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
        mesh.material.uniforms.opacity.value = smooth(0, 0.7, d);
        if (d > -2 && d < FAR) load(mesh, 1);
        if (d > 0 && d < 10) load(mesh, 2);
      });

      ray.setFromCamera(mouse, camera);
      const hit = mouse.x <= 1 ? ray.intersectObjects(photos).find((h) => h.object.material.uniforms.opacity.value > 0.5) : null;
      hover = hit ? hit.object : null;
      canvas.style.cursor = hover ? 'pointer' : '';
      photos.forEach((mesh) => {
        const s = mesh === hover ? 1.05 : 1;
        mesh.userData.hover = (mesh.userData.hover || 1) + (s - (mesh.userData.hover || 1)) * 0.15;
        const { size } = mesh.material.uniforms;
        mesh.scale.set(size.value.x * mesh.userData.hover, size.value.y * mesh.userData.hover, 1);
      });
      if (caption) {
        if (hover) {
          const p = hover.userData.photo;
          caption.firstChild.textContent = p.title;
          caption.lastChild.textContent = p.place || '';
          caption.style.opacity = '1';
        } else caption.style.opacity = '0';
      }

      // Which section are we walking through?
      let now2 = null;
      marks.forEach((mk) => { if (camZ < mk.z + 3) now2 = mk; });
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
        railButtons.forEach((b, i) => b.setAttribute('aria-current', String(marks[i] === current)));
      }
      const tz = -camZ;
      if (threshold) threshold.style.opacity = (smooth(6.8, 8.8, tz) * (1 - smooth(11.5, 14, tz))).toFixed(3);
      if (cue) cue.style.opacity = (1 - smooth(0, 0.8, tz)).toFixed(3);
      if (rail) rail.style.opacity = smooth(-START - 4, -START, tz).toFixed(3);
      if (exit) {
        const ex = smooth(-END - 8, -END - 3, tz);
        exit.style.opacity = ex.toFixed(3);
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
      window.removeEventListener('wheel', pause);
      window.removeEventListener('touchstart', pause);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      photos.forEach((m) => { m.material.uniforms.map.value.dispose(); m.material.dispose(); m.geometry.dispose(); });
      renderer.dispose();
    };
    // The scene is built once per manifest; drift, pause, and onOpen are read live.
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (replayKey && api.current) api.current.replay();
  }, [replayKey]);

  const set = (key) => (el) => { ui.current[key] = el; };
  return (
    <section ref={rootRef} className="walk" aria-label="Every photo, one after another">
      <div className="walk__view">
        <canvas ref={canvasRef} className="walk__canvas" aria-label="Photos floating in a dark space. Click one to open it." />

        <div ref={set('cue')} className="walk__cue">
          <svg role="img" aria-label="Scroll down" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        <div ref={set('threshold')} className="walk__threshold" style={{ opacity: 0 }}>
          <div className="walk__panel">
            <h1>{about.headline}</h1>
            {about.bio && <p>{about.bio}</p>}
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

        <nav ref={set('rail')} className="walk__rail" aria-label="Sections">
          {sections.map((s) => <button key={s.slug} type="button">{s.name}</button>)}
        </nav>

        <div ref={set('exit')} className="walk__exit" style={{ opacity: 0, visibility: 'hidden' }}>
          <div className="walk__panel">
            {about.quote && <p className="serif walk__words">{about.quote}</p>}
            {about.now && <p><span style={{ color: 'var(--pink)', fontWeight: 500 }}>Now:</span> {about.now}</p>}
            <div className="walk__links">
              {about.instagram && <a className="btn" href={about.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {about.bluesky && <a className="btn" href={about.bluesky} target="_blank" rel="noopener noreferrer">Bluesky</a>}
              {about.projectsUrl && <a className="btn" href={about.projectsUrl} target="_blank" rel="noopener noreferrer">Other projects</a>}
              {about.email && <a className="btn" href={`mailto:${about.email}`}>Email me</a>}
            </div>
          </div>
        </div>

        <div ref={set('veil')} className="walk__veil" aria-hidden="true" />
      </div>
    </section>
  );
}
