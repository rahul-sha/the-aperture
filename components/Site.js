'use client';

import { useEffect, useRef, useState } from 'react';
import Walk, { Timeline } from './Walk';
import AllPhotos from './AllPhotos';
import Lightbox from './Lightbox';
import Cursor from './Cursor';
import ContextMenu from './ContextMenu';

// Anyone who asked their device for less motion starts the drift themselves.
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Site({ manifest }) {
  // Drift starts from the welcome after the collage, or the header switch.
  const [drift, setDrift] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [grid, setGrid] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { photos, index }
  // Without WebGL there is no walk to draw, so the page becomes All photos.
  const [noWalk, setNoWalk] = useState(false);
  const railRef = useRef(null);
  const walkRef = useRef(null);

  const backToStart = () => {
    setGrid(false);
    setLightbox(null);
    setDrift(false);
    setReplayKey((k) => k + 1);
  };

  // The mode dial on the behind the scenes page links here with #about or
  // #all; the walk takes a moment to load before it can go to the end.
  useEffect(() => {
    const want = window.location.hash;
    if (want !== '#about' && want !== '#all') return undefined;
    window.history.replaceState(null, '', window.location.pathname);
    if (want === '#all') { setGrid(true); return undefined; }
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (walkRef.current || tries > 40) { clearInterval(t); setTimeout(() => walkRef.current?.toEnd(), 400); }
    }, 150);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <header className="header">
        <button type="button" className="header__name" onClick={backToStart} title="Back to the start"><img className="header__mark" src="/logo-mark.webp" alt="" width="26" height="26" />The Aperture</button>
        <Timeline manifest={manifest} railRef={railRef} onHome={backToStart} />
        {!noWalk && <div className="header__tools">
          <button type="button" className="header__btn" onClick={() => setGrid(true)}>All photos</button>
          <button
            type="button"
            className="header__btn header__drift"
            aria-pressed={drift}
            onClick={() => setDrift((d) => !d)}
            title={drift ? 'The page moves on its own. Scroll any time to take over.' : 'Let the page move on its own'}
          >
            Drift
          </button>
          <button type="button" className="header__replay" onClick={backToStart} aria-label="Back to the start" title="Back to the start">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
        </div>}
      </header>

      <main>
        <h1 className="visually-hidden">The Aperture: photographs by {manifest.about.name}</h1>
        {noWalk ? (
          <AllPhotos manifest={manifest} standalone onOpen={(photos, index) => setLightbox({ photos, index })} />
        ) : (
          <Walk
            manifest={manifest}
            drift={drift}
            paused={grid || !!lightbox}
            replayKey={replayKey}
            railRef={railRef}
            controlRef={walkRef}
            onGo={() => { if (!reducedMotion()) setDrift(true); }}
            onOpen={(photos, index) => setLightbox({ photos, index })}
            onNoWalk={() => setNoWalk(true)}
          />
        )}
      </main>

      {grid && <AllPhotos manifest={manifest} onOpen={(photos, index) => setLightbox({ photos, index })} onClose={() => setGrid(false)} />}

      <Cursor />
      <ContextMenu
        about={manifest.about}
        onHome={backToStart}
        onAbout={() => { setGrid(false); setLightbox(null); setDrift(false); walkRef.current?.toEnd(); }}
        onAll={() => { setLightbox(null); setGrid(true); }}
      />

      {lightbox && (
        <Lightbox
          manifest={manifest}
          photos={lightbox.photos}
          index={lightbox.index}
          onStep={(d) => setLightbox((lb) => ({ ...lb, index: (lb.index + d + lb.photos.length) % lb.photos.length }))}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
