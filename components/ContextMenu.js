'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { click, listenForAudio } from '../lib/click';

// Right-click (or touch and hold on a phone) opens a camera mode dial around
// the pointer instead of the browser's menu. Like a real mode dial it turns:
// each scroll notch rotates the ring one click, and whatever sits on the right,
// inside the pink frame, is the setting. Click the centre (or press Enter) to
// go there. Socials is a setting of its own that opens an outer dial on the
// right with Instagram and Bluesky; right-click or Escape steps back.
// On a phone: touch and hold, slide towards an item without lifting (the frame
// follows your finger, sliding past the edge on Socials reaches the outer dial),
// then lift to go. Lifting without sliding leaves the dial open for a tap.
const HOLD = 500; // ms a finger rests before the dial opens
const AT = 90; // where the chosen item sits: 90 degrees is the right-hand side
const R = 80; // radius of the ring the icons sit on, in px
const SUB = 32; // degrees between options on the outer dial
const SUB_R = 175; // radius of the outer dial's options

const ICONS = {
  home: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  about: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></>,
  all: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>,
  socials: <><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="6" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M8.4 10.8l7.2-3.6M8.4 13.2l7.2 3.6" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></>,
  bluesky: <path d="M12 11.2C10.6 8.5 6.9 4.6 3.5 4.1c0 2.6.3 6.6 4.2 7.4-3.3.9-3.6 3.6-1.9 5.2 2.4 2.2 5-1.4 6.2-4.4 1.2 3 3.8 6.6 6.2 4.4 1.7-1.6 1.4-4.3-1.9-5.2 3.9-.8 4.2-4.8 4.2-7.4-3.4.5-7.1 4.4-8.5 7.1z" />,
  // An aperture: six blades round a hexagonal opening.
  scenes: <><path d="M3.5 10h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" /><path d="M3.5 10L3 6.6l16.4-2.3.5 3.4z" /><path d="M7.4 6l2.2 3.2M11.6 5.4l2.2 3.2M15.8 4.8l2.2 3.2M3.5 13.5h17" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5 12 13l8.5-6.5" /></>,
};
const Icon = ({ k }) => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ICONS[k]}</svg>
);
// The focus point's corner brackets, as on the cursor, framing the chosen item.
const Frame = ({ className, w, h }) => (
  <svg className={className} aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d={`M1 11V1h10M${w - 11} 1h10v10M${w - 1} ${h - 11}v10h-10M11 ${h - 1}H1v-10`} />
  </svg>
);

// Pages of this site swap in place (no blank frame between documents);
// anything else is a plain link.
const Anchor = ({ href, ...rest }) => (href.startsWith('/') ? <Link href={href} {...rest} /> : <a href={href} {...rest} />);

const mod = (a, n) => ((a % n) + n) % n;
const near = (d, n) => { const m = mod(d, n); return m > n / 2 ? m - n : m; }; // the short way round
const angle = (a, b) => mod(a - b + 180, 360) - 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pt = (r, deg) => { const t = (deg * Math.PI) / 180; return `${(Math.sin(t) * r).toFixed(2)} ${(-Math.cos(t) * r).toFixed(2)}`; };

// The knurled edge: fine ticks, a longer one every eighth.
const KNURL = Array.from({ length: 96 }, (_, k) => {
  const a = k * 3.75;
  return <path key={k} d={`M${pt(k % 8 ? 126 : 122, a)}L${pt(133, a)}`} />;
});

export default function ContextMenu({ about, onHome, onAbout, onAll }) {
  // { x, y, touch, drag, turn, pos, level, sub }: pos counts notches turned
  // (it keeps counting past a full turn, so the ring never spins back);
  // level 1 means the outer dial is in use, with sub the option on it.
  const [dial, setDial] = useState(null);
  const router = useRouter();
  const ref = useRef(null);
  const before = useRef(null); // where keyboard focus was before the dial opened
  const live = useRef({}); // the latest dial, items, and actions, for the window listeners

  const done = (fn) => () => { setDial(null); fn?.(); };
  const socials = [
    about.instagram && { key: 'instagram', label: 'Instagram', short: 'Instagram', href: about.instagram },
    about.bluesky && { key: 'bluesky', label: 'Bluesky', short: 'Bluesky', href: about.bluesky },
    about.email && { key: 'email', label: 'Email me', short: 'Email', href: `mailto:${about.email}` },
  ].filter(Boolean);
  const items = [
    // Away from the walk (the behind the scenes page) these lead back to it.
    { key: 'home', label: 'Back to the start', short: 'Start', ...(onHome ? { onClick: done(onHome) } : { href: '/' }) },
    { key: 'all', label: 'All photos', short: 'Photos', ...(onAll ? { onClick: done(onAll) } : { href: '/#all' }) },
    { key: 'about', label: 'About', short: 'About', ...(onAbout ? { onClick: done(onAbout) } : { href: '/#about' }) },
    // The only way in to the behind the scenes page; nothing else on the site links to it.
    { key: 'scenes', label: 'The making of', short: 'Making of', href: '/behind-the-scenes' },
    // A group of one is just that one link.
    socials.length > 1 ? { key: 'socials', label: 'Socials', short: 'Socials', children: socials } : socials[0],
  ].filter(Boolean);
  const N = items.length;
  const STEP = 360 / N;
  const current = dial && items[mod(dial.pos, N)];
  const kids = current?.children;

  // Go to a setting: a link opens (outside links in a new tab), anything else runs.
  const go = (it) => {
    setDial(null);
    if (it.onClick) it.onClick();
    else if (it.href.startsWith('http')) window.open(it.href, '_blank', 'noopener,noreferrer');
    else router.push(it.href);
  };
  live.current = {
    dial, items, N, STEP,
    turnBy(d) {
      setDial((v) => {
        if (!v) return v;
        if (!v.level) return { ...v, drag: false, pos: v.pos + d };
        const n = items[mod(v.pos, N)].children.length;
        return { ...v, drag: false, sub: clamp(v.sub + d, 0, n - 1) };
      });
    },
    choose() {
      const v = live.current.dial;
      if (!v) return;
      const it = items[mod(v.pos, N)];
      if (v.level) go(it.children[v.sub]);
      else if (it.children) setDial({ ...v, level: 1, sub: 0 });
      else go(it);
    },
    back() { setDial((v) => (v?.level ? { ...v, level: 0 } : null)); },
    // Where a sliding finger points: the item in that direction, or past the
    // ring on Socials, the outer dial's option in that direction.
    pick(dx, dy) {
      const v = live.current.dial;
      const d = Math.hypot(dx, dy);
      if (!v || d < 30) return false;
      const a = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const g = AT + (v.pos - v.turn) * STEP;
      const group = items[mod(v.pos, N)].children;
      if (group && d > 124 && Math.abs(angle(a, g)) < 56) {
        const sub = clamp(Math.round(angle(a, g) / SUB + (group.length - 1) / 2), 0, group.length - 1);
        if (v.level !== 1 || v.sub !== sub) setDial({ ...v, level: 1, sub });
        return true;
      }
      const i = mod(Math.round(angle(a, AT - v.turn * STEP) / STEP), N);
      const pos = v.pos + near(i - mod(v.pos, N), N);
      if (pos !== v.pos || v.level) setDial({ ...v, pos, level: 0 });
      return true;
    },
  };

  useEffect(() => {
    listenForAudio();
    const L = () => live.current;
    const open = (x, y, touch) => {
      const m = 152;
      if (!ref.current) before.current = document.activeElement;
      // Room on the right for the outer dial.
      const right = Math.max(m, window.innerWidth - 222);
      setDial((v) => {
        const pos = v ? v.pos : 0;
        return { x: clamp(x, m, right), y: clamp(y, m, Math.max(m, window.innerHeight - m)), touch, drag: touch, turn: pos, pos, level: 0, sub: 0 };
      });
    };
    const close = () => setDial(null);

    const onMenu = (e) => {
      e.preventDefault();
      if (held) return;
      // Android sends its own long-press menu event; treat it as the hold.
      const touch = !!hold;
      if (touch) { const h = hold; cancelHold(); held = true; startDrag(h.id, e.clientX, e.clientY); }
      // A right-click on the open dial steps back off the outer dial.
      if (!touch && L().dial?.level && ref.current?.contains(e.target)) { L().back(); return; }
      open(e.clientX, e.clientY, touch);
    };

    // Scroll turns the dial a notch at a time. A mouse wheel notch is one
    // click; a trackpad's smaller steps add up. The walk must not scroll too.
    let acc = 0;
    let lastWheel = 0;
    const onWheel = (e) => {
      if (!L().dial) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) d *= 33;
      const now = performance.now();
      if (Math.abs(d) >= 50 && Number.isInteger(d)) {
        if (now - lastWheel > 45) L().turnBy(Math.sign(d));
        lastWheel = now;
        acc = 0;
        return;
      }
      if (now - lastWheel > 260) acc = 0;
      lastWheel = now;
      acc += d;
      while (Math.abs(acc) >= 42) { L().turnBy(Math.sign(acc)); acc -= 42 * Math.sign(acc); }
    };
    const onKey = (e) => {
      if (!L().dial) return;
      const k = e.key;
      let used = true;
      if (k === 'ArrowRight' || k === 'ArrowDown') L().turnBy(1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp') L().turnBy(-1);
      else if (k === 'Enter' || k === ' ') L().choose();
      else if (k === 'Escape' || k === 'Backspace') L().back();
      else used = false;
      if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    };

    // Touch and hold: a finger that rests still for half a second. Moving it
    // first (a scroll, or dragging the timeline) cancels. Once open, sliding
    // turns the dial and lifting chooses. The tap that ends the hold is
    // swallowed, so it doesn't also open the photo underneath or choose.
    let hold = null; // { id, x, y, timer }
    let held = false;
    let drag = null; // { id, moved, aimed }
    let swallowUntil = 0;
    const cancelHold = () => { if (hold) clearTimeout(hold.timer); hold = null; };
    const startDrag = (id) => { drag = { id, moved: false, aimed: false }; };
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) close();
      cancelHold();
      held = false;
      drag = null;
      if (e.pointerType !== 'touch' || ref.current?.contains(e.target) || e.target.closest?.('.walk__timeline')) return;
      const { clientX: x, clientY: y, pointerId: id } = e;
      hold = { id, x, y, timer: setTimeout(() => { hold = null; held = true; startDrag(id); click(); open(x, y, true); }, HOLD) };
    };
    const onMove = (e) => {
      if (hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) cancelHold();
      const v = L().dial;
      if (!drag || e.pointerId !== drag.id || !v) return;
      const dx = e.clientX - v.x;
      const dy = e.clientY - v.y;
      if (Math.hypot(dx, dy) > 30) drag.moved = true;
      drag.aimed = L().pick(dx, dy);
    };
    const onUp = (e) => {
      cancelHold();
      if (!drag || e.pointerId !== drag.id) return;
      const { moved, aimed } = drag;
      drag = null;
      if (moved && aimed) { swallowUntil = performance.now() + 500; L().choose(); }
    };
    // While a finger turns the dial, the page underneath must not scroll.
    const onTouchMove = (e) => { if (drag && e.cancelable) e.preventDefault(); };
    const onClick = (e) => {
      if (performance.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); return; }
      // The lift that ends a hold lands on the dial's centre; it isn't a choice.
      if (!held) return;
      held = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onCancel = (e) => { cancelHold(); if (drag && e.pointerId === drag.id) drag = null; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onMenu);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      cancelHold();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('contextmenu', onMenu);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  // Each notch clicks, and on a phone that allows it, buzzes.
  const notch = dial ? `${mod(dial.pos, N)}|${dial.level}|${dial.sub}` : null;
  const lastNotch = useRef(null);
  useEffect(() => {
    if (notch && lastNotch.current && notch !== lastNotch.current) click();
    lastNotch.current = notch;
  }, [notch]);

  // A keyboard or mouse keeps focus on the chosen item; a finger just sees the dial.
  const open = !!dial;
  // While the dial is open the focus-point cursor steps aside for the
  // ordinary pointer (globals.css), so it never sits over the dial.
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.dial = '';
    else delete root.dataset.dial;
    return () => { delete root.dataset.dial; };
  }, [open]);
  const focusKey = dial && !dial.touch ? notch : null;
  useEffect(() => {
    if (focusKey) ref.current?.querySelector('[data-on="true"]')?.focus({ preventScroll: true });
    else if (!open && before.current?.isConnected && document.activeElement === document.body) before.current.focus({ preventScroll: true });
  }, [focusKey, open]);

  if (!dial) return null;
  const { pos, level, sub, drag } = dial;
  const turn = drag ? dial.turn : pos; // a sliding finger moves the frame, not the ring
  const g = AT + (pos - turn) * STEP; // where the chosen item is
  const c = kids ? (kids.length - 1) / 2 : 0;
  const style = {
    left: dial.x, top: dial.y,
    '--rot': `${AT - turn * STEP}deg`,
    '--g': `${g}deg`,
    '--srot': `${drag ? 0 : -(sub - c) * SUB}deg`,
    '--sg': `${g + (drag ? (sub - c) * SUB : 0)}deg`,
  };
  const name = level ? kids[sub].label : current.label;
  const hint = level ? (dial.touch ? 'Lift to go' : 'Right-click: back')
    : kids ? (dial.touch ? 'Slide out' : 'Click to open') : (dial.touch ? 'Slide, then lift' : 'Click to go');

  const link = (it) => (it.href ? { href: it.href, ...(it.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}), onClick: done() } : {});
  const span = kids ? (c + 0.5) * SUB + 10 : 0;

  return (
    <div ref={ref} className={`dial${kids && !level ? ' is-group' : ''}${level ? ' is-outer' : ''}`} role="menu" aria-label="The Aperture" style={style}>
      <div className="dial__in">
        <div className="dial__bg" />
        {kids && (
          <div className="dial__sub">
            <div className="dial__sub-rot">
              <svg className="dial__band" viewBox="-216 -216 432 432" aria-hidden="true">
                <path className="dial__band-fill" d={`M${pt(150, -span)}A150 150 0 0 1 ${pt(150, span)}L${pt(200, span)}A200 200 0 0 0 ${pt(200, -span)}Z`} />
                {Array.from({ length: Math.floor((2 * span - 6) / 3) + 1 }, (_, k) => -span + 3 + k * 3).map((a) => <path key={a} d={`M${pt(194, a)}L${pt(200, a)}`} />)}
              </svg>
              {kids.map((k, j) => {
                const on = level === 1 && j === sub;
                return (
                  <Anchor key={k.key} className="dial__child" role="menuitem" aria-label={k.label} data-on={on} tabIndex={on ? 0 : -1} style={{ '--b': `${(j - c) * SUB}deg` }} {...link(k)}>
                    <Icon k={k.key} /><span>{k.short}</span>
                  </Anchor>
                );
              })}
            </div>
            <Frame className="dial__sub-frame" w={74} h={54} />
          </div>
        )}
        <div className="dial__rot">
          <svg className="dial__ring" viewBox="-146 -146 292 292" aria-hidden="true">
            <circle r="133" />
            <circle r="118" />
            {KNURL}
          </svg>
          {items.map((it, i) => {
            const on = level === 0 && i === mod(pos, N);
            const common = {
              className: 'dial__item', role: 'menuitem', 'aria-label': it.label, 'data-on': on, tabIndex: on ? 0 : -1,
              style: { '--a': `${i * STEP}deg`, animationDelay: `${i * 25}ms` },
            };
            const body = <><Icon k={it.key} /><span>{it.short}</span></>;
            if (it.href) return <Anchor key={it.key} {...common} {...link(it)}>{body}</Anchor>;
            const onClick = it.children ? () => setDial((v) => ({ ...v, pos: v.pos + near(i - mod(v.pos, N), N), level: 1, sub: 0 })) : it.onClick;
            return <button key={it.key} type="button" {...common} onClick={onClick}>{body}</button>;
          })}
        </div>
        <svg className="dial__hub-ring" viewBox="-146 -146 292 292" aria-hidden="true"><circle r="42" /></svg>
        <div className="dial__index" aria-hidden="true" />
        <Frame className="dial__frame" w={76} h={60} />
        <button type="button" className="dial__hub" tabIndex={-1} aria-hidden="true" onClick={() => live.current.choose()}>
          <span className="dial__name">{name}</span>
          <span className="dial__hint">{hint}</span>
        </button>
      </div>
    </div>
  );
}
