import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Woodlem Park | Next-Gen Portal',
  description: 'Woodlem Park School Portal — Student, Teacher, Admin and Parent dashboards with Holistic Development Hub.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
