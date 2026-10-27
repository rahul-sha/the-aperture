'use client';

import { useEffect, useRef, useState } from 'react';
import { photoSrc, thumbSrc } from '../lib/photos';

const GAP = 8;

function ratioOf(p) {
  return p.w && p.h ? p.w / p.h : 1.5;
}

// Packs photos into rows so that, at the stage's width and height, every
// photo is shown at its own aspect ratio. Rows get a weight equal to their
// natural height (width divided by the sum of the ratios in the row), and
// cells a weight equal to their ratio, so flexbox lays everything out at
// scale. The number of rows is chosen so the natural total height is as
// close as possible to the space available.
function buildRows(photos, width, height) {
  if (!photos.length) return [];
  const ratios = photos.map(ratioOf);
  const total = ratios.reduce((a, b) => a + b, 0);
  let best = null;
  const maxRows = Math.min(photos.length, 8);
  for (let k = 1; k <= maxRows; k += 1) {
    const target = total / k;
    const rows = [];
    let cur = [];
    let sum = 0;
    photos.forEach((p, i) => {
      const r = ratios[i];
      const remainingRows = k - rows.length - 1;
      if (cur.length && remainingRows > 0 && sum + r / 2 > target && photos.length - i >= remainingRows) {
        rows.push({ items: cur, sum });
        cur = [];
        sum = 0;
      }
      cur.push({ photo: p, r, gi: i });
      sum += r;
    });
    if (cur.length) rows.push({ items: cur, sum });
    if (rows.some((row) => row.items.length === 1 && photos.length > 1 && k > 1)) continue;
    const natural = rows.reduce((h, row) => h + (width - GAP * (row.items.length - 1)) / row.sum, 0) + GAP * (rows.length - 1);
    const score = Math.abs(Math.log(natural / height));
    if (!best || score < best.score) best = { rows, score };
  }
  return best.rows.map((row) => ({ ...row, natural: (width - GAP * (row.items.length - 1)) / row.sum }));
}

export default function Gallery({ manifest, onOpen }) {
  const [sec, setSec] = useState(manifest.sections[0]?.slug);
  const [hover, setHover] = useState(null); // { r, j }
  const [epoch, setEpoch] = useState(0); // bumping this replays the reveal
  const [size, setSize] = useState({ w: 1200, h: 720 });
  const rowsRef = useRef(null);

  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth || 1200, h: el.clientHeight || 720 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const section = manifest.sections.find((s) => s.slug === sec) || manifest.sections[0];
  const rows = buildRows(section.photos, size.w, size.h);
  const GROW = 2.2; // a hovered photo and its row both grow by this, so its shape holds

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

      <div key={epoch} ref={rowsRef} className="rows" onMouseLeave={() => setHover(null)}>
        {rows.map((row, r) => {
          const rowHover = hover && hover.r === r;
          return (
            <div key={r} className="row" style={{ flex: `${(row.natural * (rowHover ? GROW : 1)).toFixed(2)} 1 0px` }}>
              {row.items.map((it, j) => {
                const on = rowHover && hover.j === j;
                const dim = hover && !on;
                const delay = `${(0.08 + it.gi * 0.07).toFixed(2)}s`;
                return (
                  <button
                    key={it.photo.id}
                    type="button"
                    className={`cell${dim ? ' cell--dim' : ''}`}
                    style={{ flex: `${(it.r * (on ? GROW : 1)).toFixed(3)} 1 0px`, '--ar': it.r.toFixed(3) }}
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
