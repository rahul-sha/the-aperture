'use client';

import { useEffect, useState } from 'react';

// The route on the behind the scenes page, drawn like the site's timeline:
// one word over a hairline per stop, with the stop you are reading in pink.
export default function RouteBar({ stops }) {
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const els = stops.map((s) => document.getElementById(`stop-${s.id}`));
    const mark = () => {
      const line = window.innerHeight * 0.45;
      let at = -1;
      els.forEach((el, i) => { if (el && el.getBoundingClientRect().top < line) at = i; });
      setCurrent(at);
    };
    mark();
    window.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('resize', mark);
    return () => {
      window.removeEventListener('scroll', mark);
      window.removeEventListener('resize', mark);
    };
  }, [stops]);

  return (
    <nav className="bts__bar-nav" aria-label="Stops on the route">
      {stops.map((s, i) => (
        <a key={s.id} href={`#stop-${s.id}`} aria-label={s.short} aria-current={i === current ? 'true' : undefined}>
          <span className="bts__long">{s.short}</span>
          <span className="bts__short" aria-hidden="true">{i + 1}</span>
        </a>
      ))}
    </nav>
  );
}
