import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Feasora.ai - AI Site Analysis Platform',
  description: 'AI-powered site analysis for commercial real estate development',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="grid-pattern">
        <ThemeProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
