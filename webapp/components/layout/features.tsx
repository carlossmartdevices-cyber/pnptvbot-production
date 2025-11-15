'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { Video, Radio, Users, MessageSquare, Shield, Zap } from 'lucide-react';

export function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Video,
      title: t('features.liveStreams.title'),
      description: t('features.liveStreams.description'),
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      icon: Radio,
      title: t('features.radio.title'),
      description: t('features.radio.description'),
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-100 dark:bg-pink-900/20',
    },
    {
      icon: Zap,
      title: t('features.zoomRooms.title'),
      description: t('features.zoomRooms.description'),
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      icon: Users,
      title: t('features.nearby.title'),
      description: t('features.nearby.description'),
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      icon: MessageSquare,
      title: t('features.aiSupport.title'),
      description: t('features.aiSupport.description'),
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      icon: Shield,
      title: t('features.secure.title'),
      description: t('features.secure.description'),
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/20',
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            {t('features.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border p-6 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className={`inline-flex p-3 rounded-lg ${feature.bg} mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
