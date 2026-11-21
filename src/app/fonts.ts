import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';

/*
 * Self-hosted at build time by next/font: the files ship with the app, so a
 * visitor's browser never makes a request to Google.
 *
 * Plus Jakarta Sans carries the interface and every number. Instrument Serif is
 * for page titles only — at display sizes it gives the hotel register, and it
 * never has to set a figure, so the old-style-numeral problem Georgia had
 * cannot come back.
 */
export const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});
