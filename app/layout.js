import { Onest, Newsreader } from 'next/font/google';
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION as DESCRIPTION } from '../lib/site';
import './globals.css';

const onest = Onest({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], weight: ['400'], variable: '--font-serif', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
    images: [{ url: '/logo.png', alt: SITE_NAME }],
  },
  twitter: { card: 'summary', title: SITE_NAME, description: DESCRIPTION, images: ['/logo.png'] },
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
