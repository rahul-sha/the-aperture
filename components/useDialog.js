'use client';

import { useEffect } from 'react';

// For a full-screen layer (All photos, the lightbox): moves focus inside when
// it opens, keeps Tab and Shift+Tab inside while it is open, and hands focus
// back to whatever had it before once it closes.
export default function useDialog(ref, firstRef, on = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return undefined;
    const before = document.activeElement;
    (firstRef?.current || el).focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll('button, a[href], [tabindex="0"]')].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref, firstRef, on]);
}
