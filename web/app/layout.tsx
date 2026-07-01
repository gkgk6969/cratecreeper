import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gatekeep · cratecreep',
  description:
    'cratecreep by Gatekeep — screenshot a tracklist, fill your Beatport cart automatically. Stop data-entering tracklists.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
