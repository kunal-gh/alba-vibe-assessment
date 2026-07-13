
import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { ClientLayout } from '@/components/layout/client-layout';
import { Providers } from '@/components/providers';
import { ImageKitProvider } from '@/components/imagekit-provider';

export const metadata: Metadata = {
  title: "Through Hardik's Eye | Premier Photography",
  description: 'Global photography studio specializing in weddings, fashion, and portraits.',
  keywords: "photography, portfolio, wedding photography, fashion shoot, portraits, NYC photographer, Hardik studio",
  openGraph: {
    title: "Through Hardik's Eye",
    description: "Visual stories, captured with soul.",
    url: "https://civilisation.ai",
    siteName: "Hardik Studio",
    images: [{ url: "https://your-domain.vercel.app/default-og-image.jpg", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Through Hardik's Eye", description: "Visual stories, captured with soul." },
  alternates: { canonical: "https://civilisation.ai" }
};

export const viewport: import("next").Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden')}>
        <Providers>
          <ImageKitProvider>
            <ClientLayout>{children}</ClientLayout>
          </ImageKitProvider>
        </Providers>
      </body>
    </html>
  );
}
