// End-to-end checks for the built site. Run with:
//
//   npm run build && npm test
//
// `npm test` starts the production server, waits for it, runs this file,
// and stops the server again. Screenshots land in tests/screenshots/.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SITE = process.env.SITE_URL || 'http://localhost:3000';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}\n`);
  if (!ok) failures += 1;
}

// WebGL in a headless browser needs the software renderer.
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const scrollY = (page) => page.evaluate(() => window.scrollY);
const noise = (t) => /GPU stall|GL Driver/.test(t);

// Desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push(m.text()); });

  await page.goto(SITE, { waitUntil: 'networkidle' });
  check('page title', (await page.title()) === 'The Aperture');
  check('walk canvas present', (await page.locator('canvas.walk__canvas').count()) === 1);
  check('drift is off on arrival', (await page.locator('.header__drift').getAttribute('aria-pressed')) === 'false');
  check('page is tall enough to walk through', await page.evaluate(() => document.body.scrollHeight > window.innerHeight * 10));
  await page.waitForTimeout(2200); // the fly-in
  await page.screenshot({ path: `${SHOTS}01-intro.png` });
  await page.waitForTimeout(2000);
  check('page rests on the collage', (await scrollY(page)) === 0);

  // One scroll down glides to the welcome.
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(2600);
  const card = await scrollY(page);
  const cardOpacity = await page.locator('.walk__threshold').evaluate((el) => +el.style.opacity);
  check('one scroll lands on the welcome', card > 0 && cardOpacity > 0.95, `y=${card} opacity=${cardOpacity}`);
  check('the welcome is centred', await page.locator('.walk__threshold .walk__welcome').evaluate((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 4; }));
  check('the timeline sits in the header', await page.evaluate(() => !!document.querySelector('.header .walk__timeline')));
  await page.waitForTimeout(1500);
  check('the welcome waits for you', (await scrollY(page)) === card);
  await page.screenshot({ path: `${SHOTS}02-welcome.png` });

  // The next scroll starts the walk: the first section name, then the drift.
  await page.mouse.wheel(0, 120);
  check('drift switches on', (await page.locator('.header__drift').getAttribute('aria-pressed')) === 'true');
  await page.waitForTimeout(2600);
  check('first section name shows', (await page.locator('.walk__name').innerText()) === 'Overview');
  const begun = await scrollY(page);
  await page.waitForTimeout(2000);
  const after = await scrollY(page);
  check('drift moves the page on its own', after > begun + 40, `${begun} to ${after}`);

  // Scrolling yourself pauses it for a few seconds, then it carries on.
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(400);
  const held = await scrollY(page);
  await page.waitForTimeout(2000);
  check('your scroll pauses the drift', Math.abs((await scrollY(page)) - held) < 5);
  await page.waitForTimeout(3500);
  check('drift resumes after a pause', (await scrollY(page)) > held + 20);

  // The switch turns it off entirely.
  await page.locator('.header__drift').click();
  check('drift switches off', (await page.locator('.header__drift').getAttribute('aria-pressed')) === 'false');
  const off = await scrollY(page);
  await page.waitForTimeout(1500);
  check('page stays still with drift off', Math.abs((await scrollY(page)) - off) < 3);

  const segs = page.locator('.walk__seg');
  check('timeline lists six sections', (await segs.count()) === 6);
  const box = await segs.nth(1).boundingBox();
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 12, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  check('dragging the timeline moves to Reflections', (await segs.nth(1).getAttribute('aria-current')) === 'true');
  check('section title shows Reflections', (await page.locator('.walk__name').innerText()) === 'Reflections');
  await page.screenshot({ path: `${SHOTS}03-walk.png` });

  // The end mirrors the welcome: centred words over the dimmed walk.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(2500);
  const endOpacity = await page.locator('.walk__exit').evaluate((el) => +el.style.opacity);
  check('the end shows at the bottom', endOpacity > 0.95, `opacity=${endOpacity}`);
  check('the end is centred like the welcome', await page.locator('.walk__exit .walk__welcome').evaluate((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 4; }));
  check('the end links open in new tabs', await page.locator('.walk__links a[target="_blank"]').count() === 3);
  await page.screenshot({ path: `${SHOTS}03b-end.png` });

  await page.locator('.header__btn', { hasText: 'All photos' }).click();
  check('all photos opens', (await page.locator('.all').count()) === 1);
  check('all photos shows every photo', (await page.locator('.all__cell').count()) > 20);
  await page.screenshot({ path: `${SHOTS}04-all.png` });
  await page.locator('.all__cell').nth(3).click();
  check('lightbox opens', (await page.locator('.lightbox').count()) === 1);
  await page.keyboard.press('ArrowRight');
  check('lightbox steps forward', (await page.locator('.lightbox__bar small').innerText()).startsWith('5 of'));
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `${SHOTS}05-lightbox.png` });
  await page.keyboard.press('Escape');
  check('lightbox closes with Escape', (await page.locator('.lightbox').count()) === 0);
  await page.locator('.all__bar .header__btn').click();
  check('back to the walk', (await page.locator('.all').count()) === 0);

  await page.locator('.header__replay').click();
  await page.waitForTimeout(300);
  check('back to the start', (await scrollY(page)) === 0);
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.locator('.header__name').click();
  await page.waitForTimeout(300);
  check('logo goes back to the start', (await scrollY(page)) === 0);

  // Right-click shows the site's own menu; About goes to the closing words.
  await page.mouse.click(700, 450, { button: 'right' });
  check('right-click opens the site menu', (await page.locator('.dial').count()) === 1);
  await page.locator('.dial__item[aria-label="All photos"]').hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}07-menu.png`, clip: { x: 560, y: 310, width: 280, height: 280 } });
  await page.locator('.dial__item[aria-label="About"]').click();
  await page.waitForTimeout(1500);
  const endOp = await page.locator('.walk__exit').evaluate((el) => +el.style.opacity);
  check('menu About goes to the end', endOp > 0.95, `y=${await scrollY(page)} opacity=${endOp}`);
  check('menu closes after use', (await page.locator('.dial').count()) === 0);

  check('no console or page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  await page.close();
}

// Phone
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('no sideways scroll on a phone', !wide);
  await page.screenshot({ path: `${SHOTS}06-phone-intro.png` });
  await page.close();
}

await browser.close();
process.stdout.write(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
