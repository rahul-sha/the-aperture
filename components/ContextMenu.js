'use client';

import { useEffect, useRef, useState } from 'react';

// Right-click opens the site's own small menu instead of the browser's: back
// to the start, about, all photos, and the links. For a mouse or trackpad.
export default function ContextMenu({ about, onHome, onAbout, onAll }) {
  const [at, setAt] = useState(null); // { x, y }
  const ref = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const onMenu = (e) => {
      e.preventDefault();
      setAt({ x: e.clientX, y: e.clientY });
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

  // Keep the menu on screen near the pointer, and put focus on its first item.
  useEffect(() => {
    const el = ref.current;
    if (!at || !el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(at.x, window.innerWidth - r.width - 12)}px`;
    el.style.top = `${Math.min(at.y, window.innerHeight - r.height - 12)}px`;
    el.querySelector('button, a')?.focus({ preventScroll: true });
  }, [at]);

  if (!at) return null;
  const run = (fn) => () => { setAt(null); fn(); };
  const onKeyNav = (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('button, a')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const links = [
    about.instagram && ['Instagram', about.instagram],
    about.bluesky && ['Bluesky', about.bluesky],
    about.projectsUrl && ['Other projects', about.projectsUrl],
  ].filter(Boolean);

  return (
    <div ref={ref} className="menu" role="menu" aria-label="The Aperture" style={{ left: at.x, top: at.y }} onKeyDown={onKeyNav}>
      <button type="button" role="menuitem" onClick={run(onHome)}>Back to the start</button>
      <button type="button" role="menuitem" onClick={run(onAbout)}>About</button>
      <button type="button" role="menuitem" onClick={run(onAll)}>All photos</button>
      <span className="menu__rule" aria-hidden="true" />
      {links.map(([label, href]) => (
        <a key={label} role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setAt(null)}>{label}</a>
      ))}
      {about.email && <a role="menuitem" href={`mailto:${about.email}`} onClick={() => setAt(null)}>Email me</a>}
    </div>
  );
}
