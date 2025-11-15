'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/common/button';

export function CTA() {
  const { t } = useTranslation();

  return (
    <section className="py-20 md:py-32">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-20 md:px-20">
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">
              {t('hero.cta')}
            </h2>
            <p className="text-lg text-purple-100 mb-8">
              Join thousands of users already enjoying the ultimate entertainment experience.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signin">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-100"
                >
                  {t('common.getStarted')}
                </Button>
              </Link>
              <Link href="/#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-white text-white hover:bg-white/10"
                >
                  {t('common.learnMore')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Background decoration */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/50 to-pink-600/50 opacity-50" />
            <svg
              className="absolute bottom-0 left-0 opacity-20"
              width="404"
              height="404"
              fill="none"
              viewBox="0 0 404 404"
            >
              <defs>
                <pattern
                  id="grid"
                  x="0"
                  y="0"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="404" height="404" fill="url(#grid)" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
