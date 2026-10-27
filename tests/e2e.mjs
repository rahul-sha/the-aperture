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

const browser = await chromium.launch({ headless: true });

// Desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(SITE, { waitUntil: 'networkidle' });
  check('page title', (await page.title()) === 'The Aperture');
  check('nine intro cards', (await page.locator('.intro__card').count()) === 9);
  await page.waitForTimeout(2200); // let the fly-in finish
  await page.screenshot({ path: `${SHOTS}01-intro.png` });

  await page.locator('#about').scrollIntoViewIfNeeded();
  check('about card headline', (await page.locator('#about h1').count()) === 1);
  check('clock tile present', (await page.locator('.tile--clock svg line').count()) === 24);
  check('palette has 5 swatches', (await page.locator('.swatches span').count()) === 5);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}02-bento.png` });

  const chips = page.locator('.chip');
  check('six section chips', (await chips.count()) === 6);
  check('Overview selected first', (await chips.nth(0).getAttribute('aria-pressed')) === 'true');
  check('Overview shows 6 photos', (await page.locator('.cell').count()) === 6);

  await chips.filter({ hasText: 'Reflections' }).click();
  await page.waitForTimeout(1500);
  check('Reflections selected', (await chips.filter({ hasText: 'Reflections' }).getAttribute('aria-pressed')) === 'true');
  check('Reflections shows 13 photos', (await page.locator('.cell').count()) === 13);
  const stageTop = await page.locator('#gallery').evaluate((el) => Math.round(el.getBoundingClientRect().top));
  check('gallery scrolled to top of screen', Math.abs(stageTop) <= 2, `top=${stageTop}`);
  const stageHeight = await page.locator('#gallery').evaluate((el) => el.getBoundingClientRect().height);
  check('gallery fits one screen', stageHeight <= 900, `height=${stageHeight}`);
  await page.screenshot({ path: `${SHOTS}03-gallery.png` });

  await page.locator('.cell').nth(3).hover();
  await page.waitForTimeout(800);
  check('hovered cell stays in colour', !(await page.locator('.cell').nth(3).evaluate((el) => el.classList.contains('cell--dim'))));
  check('other cells dim', await page.locator('.cell').nth(0).evaluate((el) => el.classList.contains('cell--dim')));
  await page.screenshot({ path: `${SHOTS}04-hover.png` });

  await page.locator('.cell').nth(3).click();
  check('lightbox opens', (await page.locator('[role="dialog"]').count()) === 1);
  await page.keyboard.press('ArrowRight');
  check('lightbox steps forward', (await page.locator('.lightbox__bar small').innerText()) === '5 of 13');
  await page.screenshot({ path: `${SHOTS}05-lightbox.png` });
  await page.keyboard.press('Escape');
  check('lightbox closes with Escape', (await page.locator('[role="dialog"]').count()) === 0);

  await page.locator('.header__replay').click();
  await page.waitForTimeout(300);
  check('replay returns to top', (await page.evaluate(() => window.scrollY)) === 0);

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
  await page.locator('#gallery').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}06-phone-gallery.png` });
  await page.close();
}

await browser.close();
process.stdout.write(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
