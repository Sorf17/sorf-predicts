
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import AppHeader from '@/components/layout/header';
import { ThemeProvider } from '@/context/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { NavigationWarningProvider } from '@/hooks/use-navigation-warning';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: '700', variable: '--font-space' });

export const metadata: Metadata = {
  title: 'LoL Predict',
  description: 'Predict League of Legends match outcomes and compete with friends.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-body antialiased min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseClientProvider>
            <AuthProvider>
              <NavigationWarningProvider>
                <div className="absolute top-0 left-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.1)_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <AppHeader />
                <main className="container mx-auto px-4 py-8">
                  {children}
                </main>
                <Toaster />
              </NavigationWarningProvider>
            </AuthProvider>
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
