import { getManifest, thumbSrc, findPhoto } from '../../lib/photos';
import scenes from '../../content/behind-the-scenes.json';
import RouteBar from '../../components/RouteBar';
import Cursor from '../../components/Cursor';
import ContextMenu from '../../components/ContextMenu';
import './scenes.css';

// A public look at how the site works. Nothing links here except the
// right-click menu. Keep it general: ideas only, never server names,
// addresses, keys, accounts, or settings. The build log and speed figures
// live in content/behind-the-scenes.json; add an entry whenever the site
// changes.

export const metadata = {
  title: 'Behind the scenes | The Aperture',
  description: 'How a photograph gets from the camera to the 3D corridor of The Aperture.',
  alternates: { canonical: '/behind-the-scenes' },
};

const STOPS = [
  { id: 'taken', short: 'Taken' },
  { id: 'kept', short: 'Kept' },
  { id: 'curated', short: 'Curated' },
  { id: 'prepared', short: 'Prepared' },
  { id: 'stored', short: 'Stored' },
  { id: 'walked', short: 'Walked' },
];

const allPhotos = (manifest) => manifest.sections.flatMap((s) => s.photos);

// Photos hung on the two walls of the opening corridor, receding into the
// distance (the CSS walks the whole track slowly forward).
function Corridor({ manifest, photos }) {
  return (
    <div className="bts__corridor" aria-hidden="true">
      <div className="bts__track">
        {photos.slice(0, 16).map((p, i) => {
          const scale = 300 / Math.max(p.w, p.h);
          const side = i % 2 ? 1 : -1;
          const x = side * (230 + (i % 3) * 20);
          const y = ((i * 37) % 80) - 40;
          const z = -Math.floor(i / 2) * 340 + 120;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${p.id}-${i}`}
              src={thumbSrc(manifest, p)}
              alt=""
              loading={i < 6 ? 'eager' : 'lazy'}
              style={{
                width: p.w * scale,
                height: p.h * scale,
                opacity: Math.max(0.35, 1 - i * 0.04),
                transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${-side * 28}deg)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Albums at home become the parts of the site, in order.
function AlbumMap({ sections }) {
  const rows = [['Intro', 'Opening collage'], ...sections.map((s) => [s.name, s.name])];
  const h = 30 + rows.length * 37;
  return (
    <svg className="bts__map" viewBox={`0 0 360 ${h}`} role="img" aria-labelledby="bts-map-t">
      <title id="bts-map-t">{`Albums at home, each becoming one part of the site, in order: ${rows.map((r) => r[1]).join(', ')}`}</title>
      <text x="0" y="12" className="bts__ax">Album at home</text>
      <text x="360" y="12" className="bts__ax" textAnchor="end">On the site</text>
      {rows.map(([album, part], i) => {
        const y = 44 + i * 37;
        return (
          <g key={album}>
            <path d={`M0 ${y - 6} h6 l3 -3 h9 v15 h-18 z`} className="bts__alb" />
            <text x="26" y={y + 4} className="bts__lab">{album}</text>
            <path d={`M118 ${y} H226`} className="bts__link" />
            <circle cx="226" cy={y} r="2.5" className="bts__dot" />
            <line x1="240" y1={y - 15} x2="240" y2={y + 15} className={i === 0 ? 'bts__seg bts__seg--on' : 'bts__seg'} />
            <text x="360" y={y + 4} className="bts__lab" textAnchor="end">{part}</text>
          </g>
        );
      })}
    </svg>
  );
}

// The corridor drawn in perspective, over the site's timeline.
function Hall({ sections }) {
  const W = 360, H = 180, vp = { x: 180, y: 84 }, far = { w: 56, h: 30 };
  const at = (t, side, v) => {
    const x = side < 0 ? (vp.x - far.w / 2) * t : W - (W - vp.x - far.w / 2) * t;
    const top = (vp.y - far.h / 2) * t;
    const bot = H - (H - vp.y - far.h / 2) * t;
    return [x, top + (bot - top) * v];
  };
  const depths = [0.06, 0.3, 0.48, 0.62, 0.73, 0.81];
  const frames = [-1, 1].flatMap((side) => depths.map((t, i) => {
    const t2 = t + (1 - t) * (side < 0 ? 0.17 : 0.14);
    const v1 = side < 0 ? 0.28 : 0.34;
    const v2 = side < 0 ? 0.68 : 0.62;
    const pts = [at(t, side, v1), at(t2, side, v1), at(t2, side, v2), at(t, side, v2)].map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
    return { key: `${side}-${i}`, pts, here: side < 0 && i === 1, alpha: 0.5 - i * 0.07 };
  }));
  const counts = sections.map((s) => s.photos.length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const gap = 4;
  const usable = W - gap * (counts.length - 1);
  let x0 = 0;
  const segs = counts.map((n, s) => {
    const w = (n / total) * usable;
    const seg = { s, x0, w, ticks: Array.from({ length: n }, (_, k) => x0 + ((k + 0.5) * w) / n) };
    x0 += w + gap;
    return seg;
  });
  const here = segs[0] ? segs[0].ticks[Math.min(2, segs[0].ticks.length - 1)] : 0;
  return (
    <svg className="bts__hall" viewBox="0 0 360 250" role="img" aria-labelledby="bts-hall-t">
      <title id="bts-hall-t">A corridor in perspective, with photos hung on both walls and receding into the distance, above the site&apos;s timeline, where a pink marker shows where you are</title>
      {[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => (
        <line key={`${x}-${y}`} x1={x} y1={y} x2={x ? vp.x + far.w / 2 : vp.x - far.w / 2} y2={y ? vp.y + far.h / 2 : vp.y - far.h / 2} className="bts__rail" />
      ))}
      <rect x={vp.x - far.w / 2} y={vp.y - far.h / 2} width={far.w} height={far.h} className="bts__rail" />
      {frames.map((f) => (
        <polygon key={f.key} points={f.pts} className={f.here ? 'bts__frame bts__frame--here' : 'bts__frame'} style={f.here ? undefined : { fillOpacity: f.alpha }} />
      ))}
      {segs.map((g) => (
        <g key={g.s}>
          <line x1={g.x0} y1="226" x2={g.x0 + g.w} y2="226" className={g.s === 0 ? 'bts__seg bts__seg--on' : 'bts__seg'} />
          {g.ticks.map((tx, k) => <line key={k} x1={tx} y1="219" x2={tx} y2="223" className="bts__tick" />)}
        </g>
      ))}
      <circle cx={here} cy="226" r="3.5" className="bts__here" />
      <text x="0" y="246" className="bts__ax">The timeline: one tick per photo, pink where you are</text>
    </svg>
  );
}

function SpeedChart({ label, before, after, max, unit, better }) {
  const pct = (n) => `${Math.min(100, (n / max) * 100).toFixed(1)}%`;
  return (
    <figure>
      <figcaption>{label}</figcaption>
      <div className="bts__bars" role="img" aria-label={`Before: ${before}${unit}. Now: ${after}${unit}.`}>
        <div className="bts__bar"><span>Before</span><span className="bts__track-bar"><span className="bts__fill" style={{ width: pct(before) }} /></span><b>{before}{unit}</b></div>
        <div className="bts__bar bts__bar--now"><span>Now</span><span className="bts__track-bar"><span className="bts__fill" style={{ width: pct(after) }} /></span><b>{after}{unit}</b></div>
      </div>
      <p className="bts__cap">{better} Scale 0 to {max}{unit}.</p>
    </figure>
  );
}

export default async function BehindTheScenes() {
  const manifest = await getManifest();
  const photos = allPhotos(manifest);
  const introPhotos = manifest.intro.map((id) => findPhoto(manifest, id)).filter(Boolean);
  const corridor = [...introPhotos, ...photos.filter((p) => !manifest.intro.includes(p.id))];
  const finder = photos.find((p) => p.w > p.h * 1.2) || photos[0];
  const chosen = new Set([3, 14, 22, 31, 40, 45, 57, 63, 70, 78, 86, 93]);
  const latest = scenes.log[scenes.log.length - 1];
  const { about } = manifest;
  // about.quote reads '"The words." — Who said it'.
  const [quote, author] = (about.quote || '').split(/\s+—\s+/).map((s) => s.replace(/^["“]|["”]$/g, ''));

  return (
    <div className="bts">
      <div className="bts__top">
        <header className="bts__header">
          <a className="btn" href="/">The Aperture</a>
          <nav aria-label="On this page">
            <a className="btn" href="#route">The route</a>
            <a className="btn" href="#log">Build log</a>
          </nav>
        </header>

        <section className="bts__opener" aria-labelledby="bts-title">
          {photos.length > 0 && <Corridor manifest={manifest} photos={corridor} />}
          <div className="bts__dim" />
          <div className="bts__fade" />
          <div className="bts__words">
            <p className="bts__kicker">Behind the scenes</p>
            <h1 id="bts-title" className="serif">From the camera to the corridor</h1>
            <p className="bts__lede">Every photograph here takes a short walk before it reaches you. This is the route it follows, the tools that carry it, and how it was built.</p>
          </div>
        </section>
      </div>

      <main className="bts__main">
        <section className="bts__col" id="route" aria-labelledby="bts-route-h">
          <div className="bts__intro">
            <h2 id="bts-route-h" className="bts__name serif">The route</h2>
            <p>Six stops, in order. The first three happen at home and stay private. The last three are what you see.</p>
          </div>

          <RouteBar stops={STOPS} />

          <ol className="bts__stops">
            <li className="bts__stop" id="stop-taken">
              <div className="bts__text">
                <span className="bts__where">At home</span>
                <h3 className="serif">Taken</h3>
                <p>Everything starts on a phone camera, carried everywhere, at any hour. The camera matters less than having it there when something catches the eye.</p>
              </div>
              <div className="bts__viz">
                {finder && (
                  <div className="bts__finder">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbSrc(manifest, finder)} alt={finder.title || ''} width={finder.w} height={finder.h} loading="lazy" />
                    <span className="bts__b bts__b--tl" /><span className="bts__b bts__b--tr" /><span className="bts__b bts__b--bl" /><span className="bts__b bts__b--br" />
                    <span className="bts__x" />
                  </div>
                )}
                <p className="bts__cap">The focus brackets are the same ones that follow your cursor around the site.</p>
              </div>
            </li>

            <li className="bts__stop" id="stop-kept">
              <div className="bts__text">
                <span className="bts__where">At home</span>
                <h3 className="serif">Kept in a private library</h3>
                <p>The originals live in a self-hosted photo library on a small server at home, a private version of the photo apps on your phone. Photos are edited, sorted, and deleted there. Only a chosen few ever leave.</p>
              </div>
              <div className="bts__viz">
                <div className="bts__waffle" role="img" aria-label="Illustration: a grid of photos in the library, with a few outlined in pink as chosen for the site">
                  {photos.length > 0 && Array.from({ length: 96 }, (_, i) => (
                    <span key={i} className={chosen.has(i) ? 'is-on' : undefined} style={{ backgroundImage: `url(${thumbSrc(manifest, photos[(i * 7) % photos.length])})` }} />
                  ))}
                </div>
                <div className="bts__legend"><span><i className="bts__k-home" />Kept at home</span><span><i className="bts__k-chosen" />Chosen for the site</span></div>
                <p className="bts__cap">Illustration, not a real count.</p>
              </div>
            </li>

            <li className="bts__stop" id="stop-curated">
              <div className="bts__text">
                <span className="bts__where">At home</span>
                <h3 className="serif">Curated into albums</h3>
                <p>Each part of the site is one album. Adding a photo to an album is how it gets chosen, and removing it is how it leaves. An album&apos;s description becomes the quote before its section, and a photo without a title is named for where and when it was taken.</p>
              </div>
              <div className="bts__viz"><AlbumMap sections={manifest.sections} /></div>
            </li>

            <li className="bts__stop" id="stop-prepared">
              <div className="bts__text">
                <span className="bts__where">Leaving home</span>
                <h3 className="serif">Prepared for the web</h3>
                <p>A small program wakes up, reads only the chosen albums, and makes two copies of each photo: one for viewing and a small one for previews. Camera details and exact location are removed. All that survives of where a photo was taken is the city and country.</p>
              </div>
              <div className="bts__viz">
                <svg className="bts__sizes" viewBox="0 0 360 262" role="img" aria-labelledby="bts-sz-t">
                  <title id="bts-sz-t">Three frames drawn to scale: a typical 4000 by 3000 pixel phone original of 12 megapixels, the 1600 pixel viewing copy of 1.9 megapixels, and the 560 pixel preview of 0.24 megapixels</title>
                  <rect x="0.5" y="0.5" width="320" height="240" rx="8" className="bts__sz-orig" />
                  <rect x="0.5" y="144.5" width="128" height="96" rx="8" className="bts__sz-large" />
                  <rect x="0.5" y="206.9" width="44.8" height="33.6" rx="4" className="bts__sz-thumb" />
                  <text x="12" y="24" className="bts__lab">Original, kept at home</text>
                  <text x="12" y="40" className="bts__num">4000 px, 12 MP</text>
                  <text x="140" y="190" className="bts__lab bts__lab--on">Viewing copy</text>
                  <text x="140" y="206" className="bts__num">1600 px, 1.9 MP</text>
                  <text x="140" y="234" className="bts__num">Preview, 560 px</text>
                  <text x="0" y="258" className="bts__ax">Drawn to scale, for a typical phone photo</text>
                </svg>
                <div className="bts__strip" aria-label="What happens to a photo's details">
                  <span><s>Exact GPS position</s><b>City, country</b></span>
                  <span><s>Camera and lens details</s><b>Removed</b></span>
                  <span><s>Full-size original</s><b>About a sixth of the pixels</b></span>
                </div>
              </div>
            </li>

            <li className="bts__stop" id="stop-stored">
              <div className="bts__text">
                <span className="bts__where">Public</span>
                <h3 className="serif">Stored in the cloud</h3>
                <p>The web copies, and a short list of what belongs in each section, go to cloud storage that serves them quickly anywhere in the world. The route only runs one way: nothing on the public side can reach back into the library at home.</p>
              </div>
              <div className="bts__viz">
                <svg className="bts__flow" viewBox="0 0 360 124" role="img" aria-labelledby="bts-fl-t">
                  <title id="bts-fl-t">Photos travel one way: from home, to cloud storage, to your browser. There is no path back to home.</title>
                  <defs><marker id="bts-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="var(--pink)" strokeWidth="1.6" /></marker></defs>
                  <circle cx="30" cy="44" r="22" className="bts__node" /><text x="30" y="88" className="bts__lab" textAnchor="middle">Home</text>
                  <circle cx="180" cy="44" r="22" className="bts__node" /><text x="180" y="88" className="bts__lab" textAnchor="middle">Cloud</text>
                  <circle cx="330" cy="44" r="22" className="bts__node" /><text x="330" y="88" className="bts__lab" textAnchor="middle">You</text>
                  <path d="M56 44 H150" className="bts__go" markerEnd="url(#bts-ah)" />
                  <path d="M206 44 H300" className="bts__go" markerEnd="url(#bts-ah)" />
                  <path d="M300 112 H56" className="bts__back" />
                  <path d="M172 104 L188 120 M188 104 L172 120" className="bts__cross" />
                  <text x="180" y="20" className="bts__ax" textAnchor="middle">copies flow out</text>
                </svg>
                <table className="bts__access">
                  <caption>Who can do what</caption>
                  <thead><tr><td /><th scope="col">See the library</th><th scope="col">Change it</th><th scope="col">See web copies</th></tr></thead>
                  <tbody>
                    {[['The program at home', 1, 0, 1], ['The site', 0, 0, 1], ['You', 0, 0, 1]].map(([who, ...can]) => (
                      <tr key={who}><th scope="row">{who}</th>{can.map((c, i) => <td key={i}><i className={c ? 'is-yes' : 'is-no'} /><span className="visually-hidden">{c ? 'Yes' : 'No'}</span></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>

            <li className="bts__stop" id="stop-walked">
              <div className="bts__text">
                <span className="bts__where">Public</span>
                <h3 className="serif">Walked through in 3D</h3>
                <p>When you open the site, it fetches that list and builds the corridor: every photo hung in its true shape, one section after another, drawn live in your browser. The timeline in the header is the same corridor seen from above. If your device can&apos;t draw 3D, you get a plain grid of everything instead.</p>
              </div>
              <div className="bts__viz"><Hall sections={manifest.sections} /></div>
            </li>
          </ol>
        </section>

        <section className="bts__col" aria-labelledby="bts-places-h">
          <div className="bts__intro">
            <h2 id="bts-places-h" className="bts__name serif">Three places</h2>
            <p>The work is split between home, a workshop where the code is written and checked, and the public web.</p>
          </div>
          <div className="bts__places">
            <div><span className="bts__where">Private</span><h3 className="serif">Home</h3><ul><li>The photo library and every original</li><li>The albums that decide what is shown</li><li>The small program that prepares copies</li></ul></div>
            <div><span className="bts__where">Workshop</span><h3 className="serif">Code</h3><ul><li>Every change proposed, reviewed, then approved</li><li>Automatic builds when the code changes</li><li>Browser tests before anything goes live</li></ul></div>
            <div><span className="bts__where">Public</span><h3 className="serif">The web</h3><ul><li>The site, rebuilt after each approved change</li><li>Web-sized copies of the chosen photos</li><li>A network in front of both that keeps them quick and protected</li></ul></div>
          </div>
          <p className="bts__oneway">
            <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden="true"><path d="M0 6 H50" stroke="var(--hairline)" strokeWidth="1" /><path d="M46 1 L54 6 L46 11" fill="none" stroke="var(--pink)" strokeWidth="1.5" /></svg>
            Photos only ever move from left to right.
          </p>
        </section>

        <section className="bts__col" id="log" aria-labelledby="bts-log-h">
          <div className="bts__intro">
            <h2 id="bts-log-h" className="bts__name serif">Build log</h2>
            <p>Built with Claude writing the code and me reviewing and approving each change. Times are Singapore time.</p>
          </div>
          <ol className="bts__log">
            {scenes.log.map((e) => (
              <li key={e.at + e.title} className={e === latest ? 'is-now' : undefined}>
                <time dateTime={e.at}>{e.when}</time>
                <div><h3 className="serif">{e.title}</h3><p>{e.text}</p></div>
              </li>
            ))}
          </ol>
          <div className="bts__speed">{scenes.speed.map((s) => <SpeedChart key={s.label} {...s} />)}</div>
        </section>

        <section className="bts__col" aria-labelledby="bts-tools-h">
          <div className="bts__intro">
            <h2 id="bts-tools-h" className="bts__name serif">Made with</h2>
            <p>Mostly free, open tools, in plain words.</p>
          </div>
          <dl className="bts__tools">
            <div><dt>Next.js and React</dt><dd>The toolkit that builds the pages.</dd></div>
            <div><dt>three.js</dt><dd>Draws the 3D corridor in your browser.</dd></div>
            <div><dt>A self-hosted photo library</dt><dd>Where every original is kept, edited, and sorted.</dd></div>
            <div><dt>sharp</dt><dd>Resizes each photo and strips its details.</dd></div>
            <div><dt>Playwright</dt><dd>A robot browser that clicks through the site before each change goes live.</dd></div>
            <div><dt>Claude</dt><dd>Planned, designed, and wrote the code, one reviewed change at a time.</dd></div>
            <div><dt>Onest and Newsreader</dt><dd>The two typefaces you are reading now.</dd></div>
            <div><dt>A phone camera</dt><dd>The only piece of kit that matters.</dd></div>
          </dl>
        </section>

        <section className="bts__col" aria-labelledby="bts-private-h">
          <div className="bts__intro"><h2 id="bts-private-h" className="bts__name serif">What stays private</h2></div>
          <ul className="bts__private">
            <li><b>Originals</b><span>Only 1600 px copies are ever published.</span></li>
            <li><b>Exact location</b><span>The site knows a city and a country, never a street or coordinates.</span></li>
            <li><b>Camera details</b><span>Removed from every public copy.</span></li>
            <li><b>The library</b><span>The program that prepares copies can look but not change anything, and nothing public can reach it.</span></li>
          </ul>
        </section>

        <section className="bts__col bts__end" aria-label="Closing">
          {quote && <blockquote className="serif">{quote}</blockquote>}
          {author && <p className="bts__kicker">{author}</p>}
          <nav aria-label="Elsewhere">
            <a className="btn" href="/">Back to the walk</a>
            {about.instagram && <a className="btn" href={about.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {about.bluesky && <a className="btn" href={about.bluesky} target="_blank" rel="noopener noreferrer">Bluesky</a>}
          </nav>
        </section>
      </main>

      <Cursor />
      <ContextMenu about={about} />
    </div>
  );
}
