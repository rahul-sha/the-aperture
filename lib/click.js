// A soft mechanical click (and on a phone, a tiny vibration), like turning a
// dial on a camera. The timeline plays it as the scrub passes each photo, and
// the mode dial plays it on each notch. The sound is made in the browser.
let audio = null;
let clickBuf = null;
let lastClickAt = 0;
let listening = false;

// Browsers hold back sound and vibration until the visitor has tapped or
// clicked something. On a phone a drag doesn't count, only a tap, so the
// sound is woken up on the first tap, click, or key press anywhere on the page.
export function wakeAudio() {
  try {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
      const len = Math.round(audio.sampleRate * 0.03);
      clickBuf = audio.createBuffer(1, len, audio.sampleRate);
      const d = clickBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        const t = i / audio.sampleRate;
        d[i] = ((Math.random() * 2 - 1) * Math.exp(-t * 520) + Math.sin(2 * Math.PI * 2300 * t) * Math.exp(-t * 900) * 0.6) * 0.5;
      }
    }
    if (audio.state === 'suspended') audio.resume();
  } catch { /* no sound is fine */ }
}

// Listens once for the page's first gesture; safe to call from many places.
export function listenForAudio() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointerup', wakeAudio);
  window.addEventListener('touchend', wakeAudio);
  window.addEventListener('keydown', wakeAudio);
}

export function click() {
  const t0 = performance.now();
  if (t0 - lastClickAt < 28) return; // a fast drag shouldn't buzz
  lastClickAt = t0;
  // On phones that allow it (Android, not iPhone), a short tap of vibration too.
  try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12); } catch { /* fine without */ }
  try {
    wakeAudio();
    if (!audio || audio.state !== 'running') return;
    const src = audio.createBufferSource();
    src.buffer = clickBuf;
    src.playbackRate.value = 0.92 + Math.random() * 0.16;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = audio.createGain();
    gain.gain.value = 0.35;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
  } catch { /* no sound is fine */ }
}
