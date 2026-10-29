'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { photoSrc, texSrc, thumbSrc } from '../lib/photos';
import useDialog from './useDialog';

const FLY_IN = 820; // ms for a photo to float out of the walk to the screen
const FLY_OUT = 560; // ms for it to settle back into its spot
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

// The CSS transform that stretches a w by h box onto four corners on the
// screen (top left, top right, bottom right, bottom left). This is what lets a
// flat picture look as if it hangs at an angle in the 3D walk.
function quadMatrix(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let k = 0;
  if (Math.abs(sx) > 1e-6 || Math.abs(sy) > 1e-6) {
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
  }
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + k * y3;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(',')})`;
}

const rectQuad = ({ x, y, w, h }) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// On its way the photo lifts a touch towards you, as if picked up.
function lerpQuad(a, b, t, lift) {
  const q = a.map(([x, y], i) => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t]);
  const cx = q.reduce((s, p) => s + p[0], 0) / 4;
  const cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map(([x, y]) => [cx + (x - cx) * lift, cy + (y - cy) * lift]);
}

export default function Lightbox({ manifest, photos, index, onStep, onClose, quad, walk }) {
  const photo = photos[index];
  const ref = useRef(null);
  const closeRef = useRef(null);
  const flyRef = useRef(null);
  const imgRef = useRef(null);
  const run = useRef({ raf: 0, now: null, leaving: false });
  // Floating in from the walk only when opened from it, and only for anyone
  // who hasn't asked their device for less motion.
  const [fly] = useState(() => !!(quad && walk) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [flying, setFlying] = useState(fly);
  const [sharp, setSharp] = useState(false); // the full-size file has loaded
  const first = useRef(photo.id);
  const flown = fly && photo.id === first.current; // this photo came in by air
  useDialog(ref, closeRef);

  // Where the photo ends up: as large as fits the viewer, in its own shape,
  // but never larger than the file itself, since the viewer doesn't stretch
  // a small photo (w and h are the web copy's own size in pixels).
  const restRect = () => {
    const box = ref.current.querySelector('.lightbox__img').getBoundingClientRect();
    const r = (photo.w || 3) / (photo.h || 2);
    const w = Math.min(box.width, box.height * r, photo.w || Infinity);
    const h = w / r;
    return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
  };

  // Moves the floating copy from one set of corners to another.
  const animate = (from, to, ms, ease, lift, done) => {
    const el = flyRef.current;
    el.style.visibility = 'visible';
    const rest = restRect();
    el.style.width = `${rest.w}px`;
    el.style.height = `${rest.h}px`;
    const start = performance.now();
    const step = (t0) => {
      const t = Math.min(1, (t0 - start) / ms);
      const e = ease(t);
      const q = lerpQuad(from, to, e, 1 + lift * Math.sin(Math.PI * e));
      run.current.now = q;
      el.style.transform = quadMatrix(rest.w, rest.h, q);
      if (t < 1) run.current.raf = requestAnimationFrame(step);
      else done?.();
    };
    cancelAnimationFrame(run.current.raf);
    step(start);
  };

  // The dark and the words around the photo fade in (or out) with it.
  const fadeAround = (show, ms) => {
    const el = ref.current;
    const keys = show ? [0, 1] : [1, 0];
    el.animate([{ backgroundColor: `rgba(0, 0, 0, ${keys[0] * 0.95})` }, { backgroundColor: `rgba(0, 0, 0, ${keys[1] * 0.95})` }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    el.querySelectorAll('.lightbox__bar, .lightbox__caption, .lightbox__nav').forEach((n) => {
      n.animate([{ opacity: keys[0] }, { opacity: keys[1] }], { duration: ms * (show ? 0.6 : 0.5), delay: show ? ms * 0.4 : 0, easing: 'ease-out', fill: 'both' });
    });
  };

  useLayoutEffect(() => {
    if (!fly) return undefined;
    const r = run.current;
    flyRef.current.src = texSrc(manifest, thumbSrc(manifest, photo));
    fadeAround(true, FLY_IN);
    animate(quad, rectQuad(restRect()), FLY_IN, easeOut, 0.05, () => setFlying(false));
    return () => cancelAnimationFrame(r.raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The photo's spot in the walk stays empty while it is out here, and fills
  // again once the viewer is gone.
  useLayoutEffect(() => {
    if (fly) walk.hold(photo.id);
  }, [fly, walk, photo.id]);
  useEffect(() => () => { if (fly) walk.hold(null); }, [fly, walk]);

  // Close floats the photo back to its spot in the walk when it is still in view.
  const leave = () => {
    const r = run.current;
    if (r.leaving) return;
    const to = fly ? walk.quadOf(photo.id) : null;
    if (!to) { onClose(); return; }
    r.leaving = true;
    const from = flying && r.now ? r.now : rectQuad(restRect());
    if (imgRef.current?.complete) flyRef.current.src = photoSrc(manifest, photo);
    else flyRef.current.src = texSrc(manifest, thumbSrc(manifest, photo));
    setFlying(true);
    fadeAround(false, FLY_OUT);
    animate(from, to, FLY_OUT, easeInOut, 0.03, () => {
      walk.hold(null);
      onClose();
    });
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') leaveRef.current();
      if (run.current.leaving) return;
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onStep]);

  // Fetch the photos either side, so Next and Previous open at once.
  useEffect(() => {
    if (photos.length < 2) return;
    [1, -1].forEach((d) => { new Image().src = photoSrc(manifest, photos[(index + d + photos.length) % photos.length]); });
  }, [manifest, photos, index]);

  // The floating copy is the small file the walk already has; the full-size
  // photo fades in over it once it has loaded, and the copy steps aside.
  useEffect(() => {
    if (flying || run.current.leaving || !flyRef.current) return undefined;
    if (!sharp && flown) return undefined;
    const t = setTimeout(() => { if (!run.current.leaving && flyRef.current) flyRef.current.style.visibility = 'hidden'; }, 400);
    return () => clearTimeout(t);
  }, [flying, sharp, flown]);

  return (
    <div ref={ref} className="lightbox" role="dialog" aria-modal="true" aria-label={photo.title}>
      <div className="lightbox__bar">
        <span>{photo.title} <small>{index + 1} of {photos.length}</small></span>
        <button ref={closeRef} type="button" className="btn" onClick={leave}>Close</button>
      </div>
      <div className="lightbox__img">
        <img
          key={photo.id}
          ref={imgRef}
          className={flown ? 'lightbox__sharp' : 'develop'}
          style={flying ? { visibility: 'hidden' } : flown ? { opacity: sharp ? 1 : 0 } : undefined}
          src={photoSrc(manifest, photo)}
          alt={photo.title}
          onLoad={() => setSharp(true)}
        />
      </div>
      {(photo.caption || photo.place) && (
        <p className="lightbox__caption serif">
          {photo.caption}
          {photo.place && <span className="place">{photo.place}</span>}
        </p>
      )}
      <div className="lightbox__nav">
        <button type="button" className="btn" onClick={() => onStep(-1)}>Previous</button>
        <button type="button" className="btn" onClick={() => onStep(1)}>Next</button>
      </div>
      {fly && <img ref={flyRef} className="lightbox__fly" alt="" aria-hidden="true" />}
    </div>
  );
}
