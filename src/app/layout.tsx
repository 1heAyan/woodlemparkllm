import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Woodlem Park | Next-Gen Portal',
  description: 'Woodlem Park School Portal — Student, Teacher, Admin and Parent dashboards with Holistic Development Hub.',
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
      </head>
      <body>{children}</body>
    </html>
  );
}
