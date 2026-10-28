'use client';

import { useEffect, useRef } from 'react';

// A cursor like a camera's focus point: four corner brackets around a small
// cross. The brackets trail the pointer a touch, close in and turn pink when
// they settle on a photo, and tighten on anything you can click. Pressing
// down is a half-press of the shutter. Only for a mouse or trackpad.
export default function Cursor() {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const el = ref.current;
    const frame = el.querySelector('.cursor__frame');
    const root = document.documentElement;
    root.classList.add('has-cursor');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let x = -100;
    let y = -100;
    let fx = x;
    let fy = y;
    let over = null;
    let raf = 0;

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      over = e.target instanceof Element ? e.target.closest('a, button, [role="slider"], .all__cell') : null;
      el.style.opacity = '1';
    };
    const onDown = () => el.classList.add('is-down');
    const onUp = () => el.classList.remove('is-down');
    const onLeave = () => { el.style.opacity = '0'; };
    function tick() {
      raf = requestAnimationFrame(tick);
      const k = reduced ? 1 : 0.28;
      fx += (x - fx) * k;
      fy += (y - fy) * k;
      el.style.transform = `translate(${x}px, ${y}px)`;
      frame.style.transform = `translate(${(fx - x).toFixed(1)}px, ${(fy - y).toFixed(1)}px)`;
      const focus = 'focus' in root.dataset;
      el.classList.toggle('is-focus', focus);
      el.classList.toggle('is-link', !focus && !!over);
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('has-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="cursor" aria-hidden="true" style={{ opacity: 0 }}>
      <div className="cursor__frame">
        <svg className="cursor__brackets" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 11V1h10M29 1h10v10M39 29v10H29M11 39H1V29" />
        </svg>
      </div>
      <svg className="cursor__cross" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M6 1v3M6 8v3M1 6h3M8 6h3" />
      </svg>
    </div>
  );
}
