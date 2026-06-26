import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gatekeep · Crate Digger',
  description:
    'Crate Digger by Gatekeep — screenshot a tracklist, fill your Beatport cart automatically. Stop data-entering tracklists.',
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
