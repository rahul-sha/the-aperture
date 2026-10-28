'use client';

import { useState } from 'react';
import Walk from './Walk';
import AllPhotos from './AllPhotos';
import Lightbox from './Lightbox';

export default function Site({ manifest }) {
  // Drift starts with "Let's go" on the card after the collage, or the
  // header switch.
  const [drift, setDrift] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [grid, setGrid] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  return (
    <>
      <header className="header">
        <span className="header__name"><img className="header__mark" src="/logo.png" alt="" width="26" height="26" />The Aperture</span>
        <div className="header__tools">
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
          <button type="button" className="header__replay" onClick={() => { setDrift(false); setReplayKey((k) => k + 1); }} aria-label="Back to the start" title="Back to the start">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        <Walk
          manifest={manifest}
          drift={drift}
          paused={grid || !!lightbox}
          replayKey={replayKey}
          onGo={() => setDrift(true)}
          onOpen={(photos, index) => setLightbox({ photos, index })}
        />
      </main>

      {grid && <AllPhotos manifest={manifest} onOpen={(photos, index) => setLightbox({ photos, index })} onClose={() => setGrid(false)} />}

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
