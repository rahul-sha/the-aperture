'use client';

import { useState } from 'react';
import { photoSrc, thumbSrc } from '../lib/photos';

// How many photos go in each row, cycling, and how wide each one is
// relative to its neighbours. The variety is the point.
const SIZES = [4, 3, 5, 4, 6, 3];
const WIDTHS = { 2: [1.7, 1], 3: [2.4, 0.75, 1.3], 4: [0.7, 1.9, 1, 1.25], 5: [1, 0.6, 2.1, 0.85, 1.3], 6: [1.6, 0.7, 1, 0.65, 1.9, 1] };
const FALLBACK = [1, 0.7, 1.6, 0.9, 1.3, 0.75, 1.2];
const HEIGHTS = [180, 236, 150, 210];

function buildRows(photos) {
  const rows = [];
  let idx = 0;
  let r = 0;
  while (idx < photos.length) {
    let n = Math.min(SIZES[r % SIZES.length], photos.length - idx);
    if (photos.length - idx - n === 1) n += 1; // never leave one photo alone
    const widths = WIDTHS[n] && photos.length > 1 ? WIDTHS[n] : Array.from({ length: n }, (_, k) => FALLBACK[k % FALLBACK.length]);
    rows.push({ items: photos.slice(idx, idx + n).map((p, j) => ({ photo: p, w: widths[j], gi: idx + j })), base: HEIGHTS[r % HEIGHTS.length] / 180 });
    idx += n;
    r += 1;
  }
  return rows;
}

export default function Gallery({ manifest, onOpen }) {
  const [sec, setSec] = useState(manifest.sections[0]?.slug);
  const [hover, setHover] = useState(null); // { r, j }
  const [epoch, setEpoch] = useState(0); // bumping this replays the reveal

  const section = manifest.sections.find((s) => s.slug === sec) || manifest.sections[0];
  const rows = buildRows(section.photos);

  const switchTo = (slug) => {
    const el = document.getElementById('gallery');
    if (el) {
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      if (Math.abs(window.scrollY - top) > 2) window.scrollTo({ top, behavior: 'smooth' });
    }
    if (slug === sec) return;
    setSec(slug);
    setHover(null);
    setEpoch((e) => e + 1);
  };

  return (
    <div id="gallery" className="stage">
      <div className="chips" role="group" aria-label="Sections">
        {manifest.sections.map((s, i) => {
          const cover = s.photos[Math.min(3, s.photos.length - 1)] || s.photos[0];
          return (
            <button
              key={s.slug}
              type="button"
              className="chip"
              aria-pressed={s.slug === sec}
              onClick={() => switchTo(s.slug)}
              style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            >
              {cover && <img src={thumbSrc(manifest, cover)} alt="" />}
              <span className="chip__shade" />
              <span className="chip__body">
                <span className="chip__name">{s.name}</span>
                <span className="chip__quote serif">{s.quote}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div key={epoch} className="rows" onMouseLeave={() => setHover(null)}>
        {rows.map((row, r) => {
          const rowHover = hover && hover.r === r;
          return (
            <div key={r} className="row" style={{ flex: `${hover ? (rowHover ? 2.6 : 0.6) : row.base.toFixed(2)} 1 0px` }}>
              {row.items.map((it, j) => {
                const on = rowHover && hover.j === j;
                const dim = hover && !on;
                const delay = `${(0.08 + it.gi * 0.07).toFixed(2)}s`;
                return (
                  <button
                    key={it.photo.id}
                    type="button"
                    className={`cell${dim ? ' cell--dim' : ''}`}
                    style={{ flex: `${on ? (it.w * 3).toFixed(2) : it.w} 1 0px` }}
                    onMouseEnter={() => setHover({ r, j })}
                    onFocus={() => setHover({ r, j })}
                    onClick={() => onOpen(section.photos, it.gi)}
                    aria-label={`Open ${it.photo.title}`}
                  >
                    <div className="cell__wipe" style={{ animationDelay: delay }}>
                      <div className="cell__drift" style={{ animationDelay: delay }}>
                        <img src={section.photos.length > 12 ? thumbSrc(manifest, it.photo) : photoSrc(manifest, it.photo)} alt="" loading="lazy" />
                      </div>
                    </div>
                    <span className={`cell__cap${on || !hover ? '' : ' cell__cap--hidden'}`}>{it.photo.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
