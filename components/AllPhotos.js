'use client';

import { useEffect, useRef } from 'react';
import { thumbSrc } from '../lib/photos';
import useDialog from './useDialog';

// A plain view of every photo, section by section, for when you would rather
// browse than walk. Rows keep each photo's real shape. When the browser
// can't draw the walk (no WebGL), this is the page itself (standalone).
export default function AllPhotos({ manifest, onOpen, onClose, standalone = false }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  useDialog(ref, closeRef, !standalone);

  useEffect(() => {
    if (standalone) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.lightbox')) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, standalone]);

  return (
    <div ref={ref} className={standalone ? 'all all--page' : 'all'} {...(standalone ? {} : { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All photos' })}>
      <div className="all__bar">
        <span>All photos</span>
        {!standalone && <button ref={closeRef} type="button" className="header__btn" onClick={onClose}>Back to the walk</button>}
      </div>
      {manifest.sections.filter((s) => s.photos.length).map((s) => (
        <section key={s.slug} className="all__section" aria-label={s.name}>
          <div className="all__head">
            <h2 className="serif">{s.name}</h2>
            {s.quote && <p>{s.quote}</p>}
          </div>
          <div className="all__rows">
            {s.photos.map((p, i) => {
              const r = p.w && p.h ? p.w / p.h : 1.5;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="all__cell"
                  style={{ flex: `${r.toFixed(3)} 1 ${Math.round(r * 170)}px`, aspectRatio: r.toFixed(3) }}
                  onClick={() => onOpen(s.photos, i)}
                  aria-label={`Open ${p.title}`}
                >
                  <img src={thumbSrc(manifest, p)} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
