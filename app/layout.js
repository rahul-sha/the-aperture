import { Onest, Newsreader } from 'next/font/google';
import './globals.css';

const onest = Onest({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], weight: ['400'], variable: '--font-serif', display: 'swap' });

const SITE_URL = 'https://www.the-aperture.app';
const DESCRIPTION = 'Photographs by Rahul Sharma: cities, and the quiet things in between.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'The Aperture',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'The Aperture',
    title: 'The Aperture',
    description: DESCRIPTION,
    images: [{ url: '/logo.png', alt: 'The Aperture' }],
  },
  twitter: { card: 'summary', title: 'The Aperture', description: DESCRIPTION, images: ['/logo.png'] },
};

export const viewport = { themeColor: '#000000', colorScheme: 'dark' };

export default function RootLayout({ children }) {
  return (
    // Black from the very first frame, before the stylesheet arrives, so moving
    // between pages never flashes the browser's own grey or white.
    <html lang="en-GB" className={`${onest.variable} ${newsreader.variable}`} style={{ background: '#000', colorScheme: 'dark' }}>
      <body>{children}</body>
    </html>
  );
}
