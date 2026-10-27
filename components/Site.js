'use client';

import { useState } from 'react';
import Intro from './Intro';
import Bento from './Bento';
import Gallery from './Gallery';
import Lightbox from './Lightbox';

export default function Site({ manifest }) {
  const [introKey, setIntroKey] = useState(0);
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  const replay = () => {
    window.scrollTo(0, 0);
    setIntroKey((k) => k + 1);
  };

  return (
    <>
      <header className="header">
        <span className="header__name"><img className="header__mark" src="/logo.png" alt="" width="26" height="26" />The Aperture</span>
        <button type="button" className="header__replay" onClick={replay} aria-label="Replay intro" title="Replay intro">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      </header>

      <Intro key={introKey} manifest={manifest} />

      <main id="work" className="work">
        <Bento manifest={manifest} />
        <Gallery manifest={manifest} onOpen={(photos, index) => setLightbox({ photos, index })} />
      </main>

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
