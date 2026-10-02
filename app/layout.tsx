import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Studio Workspace',
  description: 'A modern, high-performance web application workspace.',
  openGraph: {
    title: 'Studio Workspace',
    description: 'A modern, high-performance web application workspace.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Studio Workspace',
    description: 'A modern, high-performance web application workspace.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
