'use client';

import { useEffect, useRef } from 'react';
import { findPhoto, photoSrc, thumbSrc } from '../lib/photos';

function hourLabel(h) {
  const n = ((h % 24) + 24) % 24;
  if (n === 0) return 'midnight';
  if (n === 12) return 'noon';
  return `${n % 12} ${n < 12 ? 'am' : 'pm'}`;
}

// Finds the six-hour window with the most photos, for the clock headline.
function peakWindow(hours) {
  let best = 0;
  let bestSum = -1;
  for (let start = 0; start < 24; start += 1) {
    let sum = 0;
    for (let i = 0; i < 6; i += 1) sum += hours[(start + i) % 24];
    if (sum > bestSum) { bestSum = sum; best = start; }
  }
  return `Mostly ${hourLabel(best)} to ${hourLabel(best + 6)}`;
}

function Clock({ hours }) {
  const max = Math.max(1, ...hours);
  const bars = hours.map((c, h) => {
    const a = ((h * 15 - 90) * Math.PI) / 180;
    const r0 = 22;
    const r1 = r0 + (c / max) * 34 + 2;
    const night = h >= 18 || h < 6;
    return (
      <line
        key={h}
        x1={(60 + r0 * Math.cos(a)).toFixed(1)}
        y1={(60 + r0 * Math.sin(a)).toFixed(1)}
        x2={(60 + r1 * Math.cos(a)).toFixed(1)}
        y2={(60 + r1 * Math.sin(a)).toFixed(1)}
        stroke={night ? '#160A05' : 'rgba(22,10,5,.35)'}
        strokeWidth="4"
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg role="img" aria-label="Photos by hour of day" viewBox="0 0 120 120">
      {bars}
      <text x="60" y="9" textAnchor="middle" fontSize="8" fill="#160A05">00</text>
      <text x="114" y="63" textAnchor="middle" fontSize="8" fill="#160A05">06</text>
      <text x="60" y="118" textAnchor="middle" fontSize="8" fill="#160A05">12</text>
      <text x="6" y="63" textAnchor="middle" fontSize="8" fill="#160A05">18</text>
    </svg>
  );
}

export default function Bento({ manifest }) {
  const { about } = manifest;
  const featured = findPhoto(manifest, manifest.featured);
  const latest = findPhoto(manifest, manifest.latest);
  const portrait = findPhoto(manifest, about.portrait);
  const featuredSection = manifest.sections.find((s) => s.slug === featured?.section);
  const latestSection = manifest.sections.find((s) => s.slug === latest?.section);
  const exif = featured ? [featured.exif.focal, featured.exif.aperture, featured.exif.shutter, featured.exif.iso, featured.exif.camera].filter(Boolean) : [];
  const dark = (manifest.latestPalette || [])[0] || '#301406';
  const light = (manifest.latestPalette || [])[3] || '#F0AB16';

  // The wrapper is sticky, so the gallery (its next sibling) slides over it.
  // --p goes from 0 while the cards are fully in view to 1 once the gallery
  // has covered them; the tiles drift up at a fraction of the scroll speed.
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current;
    const next = el?.nextElementSibling;
    if (!el || !next) return undefined;
    const onScroll = () => {
      const top = next.getBoundingClientRect().top;
      const p = Math.max(0, Math.min(1, 1 - top / window.innerHeight));
      el.style.setProperty('--p', p.toFixed(3));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  // Each tile drifts a different distance, so the layer has some depth.
  const leaving = (i) => ({ '--drift': `${-(60 + i * 30)}px` });

  return (
    <section ref={wrapRef} className="bento-wrap" aria-label="About and highlights">
    <div className="bento">
      <div id="about" className="tile tile--about" style={leaving(0)}>
        <div className="about__row">
          <div className="about__who">
            {portrait && <img src={thumbSrc(manifest, portrait)} alt="" />}
            <span><strong style={{ color: 'var(--ink)' }}>About</strong> · {about.name}, {about.city}</span>
          </div>
          <div className="about__links">
            {about.instagram && <a href={about.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {about.bluesky && <a href={about.bluesky} target="_blank" rel="noopener noreferrer">Bluesky</a>}
          </div>
        </div>
        <div className="about__text">
          <h1>{about.headline}</h1>
          <p style={{ color: 'var(--ink-soft)' }}>{about.bio}</p>
          <p className="serif" style={{ color: 'var(--ink-muted)', fontSize: 16 }}>{about.quote}</p>
          <p style={{ color: 'var(--ink-muted)' }}><span style={{ color: 'var(--pink)', fontWeight: 500 }}>Now:</span> {about.now}</p>
        </div>
        <div className="about__actions">
          <a className="btn btn--primary" href="#gallery">See the work</a>
          {about.email && <a className="btn" href={`mailto:${about.email}`}>Email me</a>}
          {about.projectsUrl && <a className="about__projects" href={about.projectsUrl} target="_blank" rel="noopener noreferrer">Other projects on rahulll.com</a>}
        </div>
      </div>

      {featured && (
        <div className="tile tile--featured" style={leaving(1)}>
          <img className="featured__backdrop" src={thumbSrc(manifest, featured)} alt="" aria-hidden="true" />
          <img className="featured__img" src={photoSrc(manifest, featured)} alt={featured.title} />
          <div className="featured__text">
            <span className="featured__kicker">Featured, from {featuredSection?.name}</span>
            <span className="featured__title">{featured.title}</span>
            {featured.caption && <span className="featured__caption serif">{featured.caption}</span>}
            {featured.place && <span className="place">{featured.place}</span>}
            {exif.length > 0 && <span className="exif">{exif.map((e) => <span key={e}>{e}</span>)}</span>}
          </div>
        </div>
      )}

      <div className="tile tile--clock" style={leaving(2)}>
        <div className="clock__text">
          <span className="clock__label">When I shoot</span>
          <span className="clock__big">{peakWindow(manifest.hours)}</span>
          <span className="clock__note">From the time stamps of every photo here</span>
        </div>
        <Clock hours={manifest.hours} />
      </div>

      {latest && (
        <div className="tile tile--latest" style={{ background: dark, ...leaving(3) }}>
          <div className="latest__img"><img src={thumbSrc(manifest, latest)} alt={latest.title} /></div>
          <div className="latest__body">
            <div className="latest__row">
              <span className="latest__kicker" style={{ color: light }}>Latest, in {latestSection?.name}</span>
              <span className="latest__title">{latest.title}</span>
            </div>
            <div className="swatches" aria-label={`Colour palette of ${latest.title}`}>
              {(manifest.latestPalette || []).map((c) => <span key={c} title={c} style={{ background: c }} />)}
            </div>
            <span className="latest__note">The colours of the newest photo, taken from the file itself</span>
          </div>
        </div>
      )}
    </div>
    </section>
  );
}
