'use client';

import { useEffect, useState } from 'react';
import { findPhoto, thumbSrc } from '../lib/photos';

// Where each of the nine collage cards sits: width, height, offset from the
// centre, and stacking order. The first card is the hero in the middle.
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

export default function Intro({ manifest }) {
  // p runs from 0 at the top of the page to 1 once the visitor has scrolled
  // 650px, and drives the cards spreading apart and fading.
  const [p, setP] = useState(0);
  // s scales the whole collage to the screen: the slots are drawn for about
  // 820 by 680 pixels, so a big screen gets bigger cards and a phone smaller.
  const [s, setS] = useState(1);

  useEffect(() => {
    const onScroll = () => setP(Math.max(0, Math.min(1, (window.scrollY || 0) / 650)));
    const onResize = () => setS(Math.max(0.6, Math.min(1.5, Math.min(window.innerWidth / 820, window.innerHeight / 680))));
    onScroll();
    onResize();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  const photos = manifest.intro.map((id) => findPhoto(manifest, id)).filter(Boolean).slice(0, SLOTS.length);
  const k = 1 + p * 1.6;

  return (
    <section className="intro" aria-label="Intro">
      {photos.map((photo, i) => {
        const [sw, sh, x, y, z] = SLOTS[i].map((v, j) => (j < 4 ? v * s : v));
        // Keep the slot's area but give it the photo's own shape.
        const ratio = photo.w && photo.h ? photo.w / photo.h : sw / sh;
        const w = Math.round(Math.sqrt(sw * sh * ratio));
        const h = Math.round(Math.sqrt((sw * sh) / ratio));
        const outer = {
          width: w,
          height: h,
          marginLeft: -w / 2 + x,
          marginTop: -h / 2 + y,
          zIndex: z,
          transform: `translate(${Math.round(x * (k - 1))}px, ${Math.round(y * (k - 1) - p * 120)}px) scale(${(1 + p * 0.25).toFixed(3)})`,
          opacity: (1 - p * 0.9).toFixed(3),
        };
        const fly = {
          animationDelay: `${i === 0 ? 0.2 : 0.35 + i * 0.12}s`,
          '--fx': `${(i % 2 ? 1 : -1) * (400 + i * 40)}px`,
          '--fy': `${((i % 3) - 1) * 260}px`,
          '--ry': `${(i % 2 ? -1 : 1) * 70}deg`,
          '--rx': `${((i % 3) - 1) * 30}deg`,
        };
        const float = {
          animationDuration: `${(4.2 + (i % 4) * 0.9).toFixed(1)}s`,
          animationDelay: `${(2.3 + i * 0.12).toFixed(2)}s`,
          '--dx': `${(i % 2 ? 1 : -1) * (6 + (i % 3) * 4)}px`,
          '--dy': `${(i % 3 ? -1 : 1) * (8 + (i % 4) * 3)}px`,
          '--dr': `${((i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.5)).toFixed(1)}deg`,
        };
        return (
          <div key={photo.id} className="intro__card" style={outer}>
            <div className="intro__fly" style={fly}>
              <div className="intro__float" style={float}>
                <img src={thumbSrc(manifest, photo)} alt="" loading="eager" />
              </div>
            </div>
          </div>
        );
      })}
      <div className="intro__cue" style={{ opacity: Math.max(0, 1 - p * 2.2) }}>
        <svg role="img" aria-label="Scroll down" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5F3EF" strokeWidth="1.6">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}
