import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Drone Sense - AI Site Analysis Terminal',
  description: 'AI-powered drone site analysis for commercial development',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grid-pattern">
        <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">DRONE SENSE</h1>
                <p className="text-xs text-[var(--text-muted)]">AI Site Analysis Terminal v1.0</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="status-dot active"></div>
                <span className="text-xs text-[var(--text-secondary)]">System Online</span>
              </div>
            </div>
          </div>
        </header>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
