'use client';

import { useEffect, useRef, useState } from 'react';

// Right-click opens a camera mode dial around the pointer instead of the
// browser's menu: icons on a lens ring, with the name of the one you point at
// in the middle. For a mouse or trackpad.
const R = 66; // radius of the ring the icons sit on, in px

const ICONS = {
  home: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  about: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></>,
  all: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></>,
  bluesky: <path d="M12 11.2C10.6 8.5 6.9 4.6 3.5 4.1c0 2.6.3 6.6 4.2 7.4-3.3.9-3.6 3.6-1.9 5.2 2.4 2.2 5-1.4 6.2-4.4 1.2 3 3.8 6.6 6.2 4.4 1.7-1.6 1.4-4.3-1.9-5.2 3.9-.8 4.2-4.8 4.2-7.4-3.4.5-7.1 4.4-8.5 7.1z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5 12 13l8.5-6.5" /></>,
};

export default function ContextMenu({ about, onHome, onAbout, onAll }) {
  const [at, setAt] = useState(null); // { x, y }
  const [label, setLabel] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const onMenu = (e) => {
      e.preventDefault();
      const m = R + 34;
      setAt({ x: Math.min(Math.max(e.clientX, m), window.innerWidth - m), y: Math.min(Math.max(e.clientY, m), window.innerHeight - m) });
      setLabel('');
    };
    const close = () => setAt(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => { if (!ref.current?.contains(e.target)) close(); };
    window.addEventListener('contextmenu', onMenu);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('contextmenu', onMenu);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('wheel', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  useEffect(() => {
    if (at) ref.current?.querySelector('.dial__item')?.focus({ preventScroll: true });
  }, [at]);

  if (!at) return null;
  const done = (fn) => () => { setAt(null); fn?.(); };
  const items = [
    { key: 'home', label: 'Back to the start', onClick: done(onHome) },
    { key: 'about', label: 'About', onClick: done(onAbout) },
    { key: 'all', label: 'All photos', onClick: done(onAll) },
    about.instagram && { key: 'instagram', label: 'Instagram', href: about.instagram },
    about.bluesky && { key: 'bluesky', label: 'Bluesky', href: about.bluesky },
    about.email && { key: 'email', label: 'Email me', href: `mailto:${about.email}` },
  ].filter(Boolean);
  // Arrow keys turn the dial.
  const onKeyNav = (e) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const els = [...ref.current.querySelectorAll('.dial__item')];
    const i = els.indexOf(document.activeElement);
    els[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div ref={ref} className="dial" role="menu" aria-label="The Aperture" style={{ left: at.x, top: at.y }} onKeyDown={onKeyNav}>
      <svg className="dial__ring" viewBox="-100 -100 200 200" aria-hidden="true">
        <circle r="92" />
        <circle r="40" />
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const l = i % 4 ? 88 : 84;
          return <line key={i} x1={Math.cos(a) * l} y1={Math.sin(a) * l} x2={Math.cos(a) * 92} y2={Math.sin(a) * 92} />;
        })}
      </svg>
      {items.map((it, i) => {
        const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
        const style = { '--x': `${(Math.cos(a) * R).toFixed(1)}px`, '--y': `${(Math.sin(a) * R).toFixed(1)}px`, animationDelay: `${i * 25}ms` };
        const icon = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.key]}</svg>;
        const common = {
          className: 'dial__item', role: 'menuitem', 'aria-label': it.label, style,
          onPointerEnter: () => setLabel(it.label), onFocus: () => setLabel(it.label),
        };
        return it.href
          ? <a key={it.key} {...common} href={it.href} {...(it.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={done()}>{icon}</a>
          : <button key={it.key} type="button" {...common} onClick={it.onClick}>{icon}</button>;
      })}
      <span className="dial__label" aria-hidden="true">{label}</span>
    </div>
  );
}
