import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import CursorSpotlight from '@/components/layout/CursorSpotlight';
import BackgroundScene from '@/components/layout/BackgroundScene';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'xBlog — Developer Stories & Ideas',
  description: 'A community of developers sharing ideas, knowledge, and stories.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased text-foreground`}>
        {/* Animated ambient background — drifting brand-aurora orbs,
            cursor-coupled glow, and floating dust particles. Pure CSS,
            sits behind every page. */}
        <BackgroundScene />
        {/* Writes --mx / --my onto :root so the aurora-cursor orb and the
            global body::before spotlight track the pointer. */}
        <CursorSpotlight />
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-200/70 backdrop-blur-sm py-6 text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} xBlog — Built with ❤️ for developers
            </footer>
          </div>
          {/* Top-center so the Dynamic-Island welcome toast can drop down
              from the notch area. `containerStyle` nudges it below the
              navbar; `gutter` keeps stacked toasts spaced. Regular
              toast.success / toast.error calls land here too. */}
          <Toaster
            position="top-center"
            gutter={8}
            /* Toast container nudged closer to the very top of the viewport
               so the cinematic welcome scene reads like it's dropping in
               from "the sky" rather than below the navbar. */
            containerStyle={{ top: 16 }}
            toastOptions={{ duration: 3000 }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
