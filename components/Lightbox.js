'use client';

import { useEffect, useRef } from 'react';
import { photoSrc } from '../lib/photos';
import useDialog from './useDialog';

export default function Lightbox({ manifest, photos, index, onStep, onClose }) {
  const photo = photos[index];
  const ref = useRef(null);
  const closeRef = useRef(null);
  useDialog(ref, closeRef);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onStep]);

  // Fetch the photos either side, so Next and Previous open at once.
  useEffect(() => {
    if (photos.length < 2) return;
    [1, -1].forEach((d) => { new Image().src = photoSrc(manifest, photos[(index + d + photos.length) % photos.length]); });
  }, [manifest, photos, index]);

  return (
    <div ref={ref} className="lightbox" role="dialog" aria-modal="true" aria-label={photo.title}>
      <div className="lightbox__bar">
        <span>{photo.title} <small>{index + 1} of {photos.length}</small></span>
        <button ref={closeRef} type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      <div className="lightbox__img">
        <img key={photo.id} className="develop" src={photoSrc(manifest, photo)} alt={photo.title} />
      </div>
      {(photo.caption || photo.place) && (
        <p className="lightbox__caption serif">
          {photo.caption}
          {photo.place && <span className="place">{photo.place}</span>}
        </p>
      )}
      <div className="lightbox__nav">
        <button type="button" className="btn" onClick={() => onStep(-1)}>Previous</button>
        <button type="button" className="btn" onClick={() => onStep(1)}>Next</button>
      </div>
    </div>
  );
}
