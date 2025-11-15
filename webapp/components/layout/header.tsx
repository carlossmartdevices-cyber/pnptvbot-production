'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/common/button';
import { useUserStore } from '@/lib/stores/user-store';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  const { t, language, setLanguage } = useTranslation();
  const user = useUserStore((state) => state.user);
  const { theme, setTheme } = useTheme();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'es' : 'en');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              PNPtv
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/#features"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {t('nav.home')}
            </Link>
            <Link
              href="/#pricing"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {t('nav.subscribe')}
            </Link>
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {t('nav.dashboard')}
                </Link>
                <Link
                  href="/profile"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {t('nav.profile')}
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label="Toggle language"
          >
            {language.toUpperCase()}
          </Button>

          {user ? (
            <Link href="/profile">
              <Button variant="default" size="sm">
                {user.displayName}
              </Button>
            </Link>
          ) : (
            <Link href="/auth/signin">
              <Button variant="default" size="sm">
                {t('common.signIn')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
