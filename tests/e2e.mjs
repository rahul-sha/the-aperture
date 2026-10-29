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
// Moves the pointer about until it rests on a photo in the walk.
async function findPhoto(page, w, h) {
  for (let x = 0.15; x < 0.9; x += 0.05) {
    for (let y = 0.3; y < 0.75; y += 0.05) {
      await page.mouse.move(w * x, h * y);
      await page.waitForTimeout(50);
      if (await page.evaluate(() => document.querySelector('canvas.walk__canvas').style.cursor === 'pointer')) return [w * x, h * y];
    }
  }
  return null;
}

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
  await page.waitForTimeout(4500);
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
  await page.waitForTimeout(4500);
  check('first section name shows', (await page.locator('.walk__name').innerText()) === 'Overview');
  check('the welcome is out of the Tab order once you move on', await page.locator('.walk__threshold').evaluate((el) => getComputedStyle(el).visibility === 'hidden'));
  check('the timeline tells a screen reader where you are', /^Overview, photo \d+ of \d+$/.test(await page.locator('.walk__slider').getAttribute('aria-valuetext')));
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

  // Clicking a photo in the walk floats it out of its spot to the screen,
  // and Close floats it back.
  const spot = await findPhoto(page, 1440, 900);
  check('a photo in the walk is under the pointer', !!spot);
  if (spot) {
    await page.mouse.click(spot[0], spot[1]);
    await page.waitForTimeout(250);
    check('the photo floats out of the walk', await page.locator('.lightbox__fly').evaluate((el) => getComputedStyle(el).visibility === 'visible' && el.style.transform.startsWith('matrix3d')));
    await page.waitForTimeout(1500);
    check('it lands in the viewer', await page.locator('.lightbox__img img').evaluate((el) => getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity === '1'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('Close floats it back first', (await page.locator('.lightbox').count()) === 1);
    await page.waitForTimeout(800);
    check('then the viewer is gone', (await page.locator('.lightbox').count()) === 0);
  }

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
  check('no email link while no address is set', await page.locator('a[href^="mailto:"]').count() === 0);
  await page.screenshot({ path: `${SHOTS}03b-end.png` });

  await page.locator('.header__btn', { hasText: 'All photos' }).click();
  check('all photos opens', (await page.locator('.all').count()) === 1);
  check('all photos shows every photo', (await page.locator('.all__cell').count()) > 20);
  await page.screenshot({ path: `${SHOTS}04-all.png` });
  await page.locator('.all__cell').nth(3).click();
  check('lightbox opens', (await page.locator('.lightbox').count()) === 1);
  check('focus moves into the lightbox', await page.evaluate(() => !!document.activeElement.closest('.lightbox')));
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
  check('Tab stays inside the lightbox', await page.evaluate(() => !!document.activeElement.closest('.lightbox')));
  await page.keyboard.press('ArrowRight');
  check('lightbox steps forward', (await page.locator('.lightbox__bar small').innerText()).startsWith('5 of'));
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `${SHOTS}05-lightbox.png` });
  await page.keyboard.press('Escape');
  check('lightbox closes with Escape', (await page.locator('.lightbox').count()) === 0);
  check('focus goes back to the photo you opened', await page.evaluate(() => document.activeElement.classList.contains('all__cell')));
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  check('Tab stays inside All photos', await page.evaluate(() => !!document.activeElement.closest('.all')));
  await page.locator('.all__bar .header__btn').click();
  check('back to the walk', (await page.locator('.all').count()) === 0);

  await page.locator('.header__replay').click();
  await page.waitForTimeout(300);
  check('back to the start', (await scrollY(page)) === 0);
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.locator('.header__name').click();
  await page.waitForTimeout(300);
  check('logo goes back to the start', (await scrollY(page)) === 0);

  // A right-click on a photo opens only the mode dial, never the photo (on
  // Windows the button is released before the menu event, so the walk sees it).
  const press = (x, y, button) => page.evaluate(([px, py, b]) => {
    const c = document.querySelector('canvas');
    for (const type of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(type, { clientX: px, clientY: py, button: b, buttons: type === 'pointerdown' ? (b === 2 ? 2 : 1) : 0, bubbles: true, pointerType: 'mouse', isPrimary: true }));
  }, [x, y, button]);
  let photoAt = null;
  for (const [px, py] of [[700, 450], [560, 400], [840, 400], [560, 520], [840, 520], [700, 330], [700, 580]]) {
    await press(px, py, 0);
    await page.waitForTimeout(400);
    if (await page.locator('.lightbox').count()) { photoAt = [px, py]; await page.keyboard.press('Escape'); await page.waitForTimeout(400); break; }
  }
  if (photoAt) {
    await press(photoAt[0], photoAt[1], 2);
    await page.waitForTimeout(400);
    check('a right-click on a photo does not open it', (await page.locator('.lightbox').count()) === 0);
  } else check('found a photo to right-click', false);

  // Right-click shows the site's own menu; About goes to the closing words.
  await page.mouse.click(700, 450, { button: 'right' });
  check('right-click opens the site menu', (await page.locator('.dial').count()) === 1);
  await page.waitForTimeout(300);
  check('the focus-point cursor hides while the dial is open', await page.evaluate(() => getComputedStyle(document.querySelector('.cursor')).opacity === '0'));
  await page.locator('.dial__item[aria-label="All photos"]').hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}07-menu.png`, clip: { x: 560, y: 310, width: 280, height: 280 } });
  await page.locator('.dial__item[aria-label="About"]').click();
  await page.waitForTimeout(1500);
  const endOp = await page.locator('.walk__exit').evaluate((el) => +el.style.opacity);
  check('menu About goes to the end', endOp > 0.95, `y=${await scrollY(page)} opacity=${endOp}`);
  check('menu closes after use', (await page.locator('.dial').count()) === 0);

  // Scroll turns the dial a notch at a time, with the chosen setting on the
  // right; Socials opens an outer dial, and Escape steps back, then closes.
  const yDial = await scrollY(page);
  await page.mouse.click(700, 450, { button: 'right' });
  await page.waitForTimeout(300);
  const chosen = () => page.locator('.dial [data-on="true"]').getAttribute('aria-label');
  check('the dial opens on Back to the start', (await chosen()) === 'Back to the start');
  for (let i = 0; i < 4; i += 1) { await page.mouse.wheel(0, 100); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);
  check('scrolling turns the dial to Socials', (await chosen()) === 'Socials');
  check('turning the dial does not move the walk', (await scrollY(page)) === yDial);
  const frameBox = await page.locator('.dial__frame').boundingBox();
  check('the chosen setting sits on the right', frameBox && frameBox.x > 700, `x=${frameBox?.x}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  check('Socials opens the outer dial', (await page.locator('.dial.is-outer').count()) === 1 && (await chosen()) === 'Instagram');
  await page.screenshot({ path: `${SHOTS}07b-menu-socials.png`, clip: { x: 520, y: 250, width: 420, height: 400 } });
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);
  check('scrolling moves along the outer dial', (await chosen()) === 'Bluesky');
  await page.keyboard.press('Escape');
  check('Escape steps back to the main dial', (await page.locator('.dial').count()) === 1 && (await page.locator('.dial.is-outer').count()) === 0);
  await page.keyboard.press('Escape');
  check('a second Escape closes the dial', (await page.locator('.dial').count()) === 0);

  // Behind the scenes is reached only from the menu.
  check('nothing on the walk links to behind the scenes', (await page.locator('a[href="/behind-the-scenes"]').count()) === 0);
  await page.mouse.click(700, 450, { button: 'right' });
  const scenesItem = page.locator('.dial__item[aria-label="The making of"]');
  check('the menu offers behind the scenes', (await scenesItem.getAttribute('href')) === '/behind-the-scenes');
  await scenesItem.click();
  await page.waitForURL('**/behind-the-scenes');
  check('behind the scenes opens in the same tab', (await page.title()) === 'Behind the scenes | The Aperture');

  check('no console or page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  await page.close();
}

// The behind the scenes page.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push(m.text()); });
  await page.goto(`${SITE}/behind-the-scenes`, { waitUntil: 'networkidle' });
  check('scenes: six stops on the route', (await page.locator('.bts__stop').count()) === 6);
  check('scenes: route bar names every stop', (await page.locator('.bts__bar-nav a').count()) === 6);
  check('scenes: every chart has a title', await page.locator('.bts__viz svg[role="img"]').evaluateAll((els) => els.every((el) => el.querySelector('title')?.textContent.length > 10)));
  check('scenes: the build log has entries', (await page.locator('.bts__log li').count()) > 5);
  check('scenes: no link to the code', (await page.locator('a[href*="github"]').count()) === 0);
  await page.locator('#stop-prepared').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  check('scenes: the route bar follows your reading', (await page.locator('.bts__bar-nav a[aria-current="true"]').getAttribute('href')) === '#stop-prepared');
  await page.screenshot({ path: `${SHOTS}10-scenes.png`, fullPage: true });
  await page.mouse.click(640, 400, { button: 'right' });
  await page.waitForTimeout(300);
  check('scenes: right-click opens the mode dial', (await page.locator('.dial').count()) === 1);
  check('scenes: the dial leads back to About on the walk', (await page.locator('.dial__item[aria-label="About"]').getAttribute('href')) === '/#about');
  await page.locator('.dial__item[aria-label="All photos"]').click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.waitForTimeout(800);
  check('scenes: the dial opens All photos on the walk', (await page.locator('.all').count()) === 1);
  check('scenes: no console or page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  await page.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await phone.goto(`${SITE}/behind-the-scenes`, { waitUntil: 'networkidle' });
  check('scenes: no sideways scroll on a phone', !(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await phone.screenshot({ path: `${SHOTS}11-scenes-phone.png`, fullPage: true });
  await phone.close();
}

// Anyone who asked for less motion: photos open in place, without floating.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 9, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  const spot = await findPhoto(page, 1440, 900);
  if (spot) {
    await page.mouse.click(spot[0], spot[1]);
    await page.waitForTimeout(100);
    check('reduced motion: the photo opens without floating', (await page.locator('.lightbox').count()) === 1 && (await page.locator('.lightbox__fly').count()) === 0);
    await page.keyboard.press('Escape');
    check('reduced motion: Close is immediate', (await page.locator('.lightbox').count()) === 0);
  } else check('reduced motion: a photo in the walk is under the pointer', false);
  await page.close();
}

// A browser that can't draw WebGL gets All photos as the page.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : real.call(this, type, ...rest); };
  });
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check('without WebGL the page shows All photos', (await page.locator('main .all--page .all__cell').count()) > 20);
  check('without WebGL nothing crashes', errors.length === 0, errors.join(' | ').slice(0, 200));
  await page.locator('.all__cell').first().click();
  check('without WebGL photos still open', (await page.locator('.lightbox').count()) === 1);
  await page.screenshot({ path: `${SHOTS}08-no-webgl.png` });
  await page.close();
}

// Phone
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('no sideways scroll on a phone', !wide);
  check('the phone timeline sits clear of the bottom edge', await page.evaluate(() => { const r = document.querySelector('.walk__timeline').getBoundingClientRect(); return innerHeight - r.bottom >= 36; }));
  await page.screenshot({ path: `${SHOTS}06-phone-intro.png` });

  // Touch and hold opens the same mode dial as a right-click.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 30, 780);
  await page.waitForTimeout(250);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  check('a quick tap does not open the dial', (await page.locator('.dial').count()) === 0);
  await touch('touchStart', 195, 420);
  await page.waitForTimeout(800);
  await touch('touchEnd');
  await page.waitForTimeout(300);
  check('touch and hold opens the dial', (await page.locator('.dial').count()) === 1);
  check('the hold does not also open a photo', (await page.locator('.lightbox').count()) === 0);
  await page.screenshot({ path: `${SHOTS}09-phone-dial.png` });
  await page.locator('.dial__item[aria-label="All photos"]').tap();
  await page.waitForTimeout(400);
  check('a tap on the dial works', (await page.locator('.all').count()) === 1 && (await page.locator('.dial').count()) === 0);

  // Hold, slide towards a setting without lifting, and let go.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await touch('touchStart', 195, 420);
  await page.waitForTimeout(800);
  for (let i = 1; i <= 6; i += 1) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 + 4 * i, y: 420 + 14 * i }] }); await page.waitForTimeout(40); }
  await page.waitForTimeout(200);
  check('sliding moves the frame to All photos', (await page.locator('.dial [data-on="true"]').getAttribute('aria-label')) === 'All photos');
  await touch('touchEnd');
  await page.waitForTimeout(500);
  check('lifting the finger goes there', (await page.locator('.all').count()) === 1 && (await page.locator('.dial').count()) === 0);
  await page.close();
}

await browser.close();
process.stdout.write(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
