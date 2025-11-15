'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/common/button';
import { Radio, Video, Users, Zap } from 'lucide-react';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-background py-20 md:py-32">
      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-900/20 px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300">
            <Zap className="h-4 w-4" />
            <span>{t('hero.title')}</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('hero.subtitle')}
          </h1>

          <p className="mb-10 text-lg text-muted-foreground sm:text-xl">
            {t('hero.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signin">
              <Button size="lg" className="w-full sm:w-auto">
                {t('hero.cta')}
              </Button>
            </Link>
            <Link href="/#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t('hero.secondaryCta')}
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Video, label: 'Live Streaming' },
              { icon: Radio, label: '24/7 Radio' },
              { icon: Users, label: 'Social Network' },
              { icon: Zap, label: 'AI Powered' },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
              >
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
                  <feature.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl xl:-top-6" aria-hidden="true">
          <div
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-purple-400 to-pink-400 opacity-20"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
      </div>
    </section>
  );
}
