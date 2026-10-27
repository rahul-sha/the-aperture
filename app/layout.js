import { Onest, Newsreader } from 'next/font/google';
import './globals.css';

const onest = Onest({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], weight: ['400'], variable: '--font-serif', display: 'swap' });

export const metadata = {
  title: 'The Aperture',
  description: 'Photographs by Rahul Sharma: cities after dark, and the quiet things in between.',
};

export const viewport = { themeColor: '#000000' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${onest.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
