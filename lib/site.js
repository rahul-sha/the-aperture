import about from '../content/about.json';

// The site's name and address, set once here and used everywhere they appear.
export const SITE_NAME = 'The Aperture';
export const SITE_URL = 'https://www.the-aperture.app';

// The line search engines and link previews show, built from the About card
// so it changes when content/about.json does.
export const SITE_DESCRIPTION = [about.name && `Photographs by ${about.name}.`, about.headline].filter(Boolean).join(' ');
