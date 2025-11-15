'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/common/button';
import { Check } from 'lucide-react';
import Link from 'next/link';

export function Pricing() {
  const { t } = useTranslation();

  const plans = [
    {
      name: t('pricing.free.name'),
      price: t('pricing.free.price'),
      description: t('pricing.free.description'),
      features: t('pricing.free.features') as unknown as string[],
      cta: t('pricing.free.cta'),
      popular: false,
      href: '/auth/signin',
    },
    {
      name: t('pricing.basic.name'),
      price: t('pricing.basic.price'),
      description: t('pricing.basic.description'),
      features: t('pricing.basic.features') as unknown as string[],
      cta: t('pricing.basic.cta'),
      popular: false,
      href: '/subscribe?plan=basic',
    },
    {
      name: t('pricing.premium.name'),
      price: t('pricing.premium.price'),
      description: t('pricing.premium.description'),
      features: t('pricing.premium.features') as unknown as string[],
      cta: t('pricing.premium.cta'),
      popular: true,
      href: '/subscribe?plan=premium',
    },
    {
      name: t('pricing.gold.name'),
      price: t('pricing.gold.price'),
      description: t('pricing.gold.description'),
      features: t('pricing.gold.features') as unknown as string[],
      cta: t('pricing.gold.cta'),
      popular: false,
      href: '/subscribe?plan=gold',
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-32 bg-gray-50 dark:bg-gray-900/50">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            {t('pricing.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl border p-8 ${
                plan.popular
                  ? 'border-purple-500 shadow-xl scale-105 bg-background'
                  : 'bg-background'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-purple-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== '$0' && (
                  <span className="text-muted-foreground">/month</span>
                )}
              </div>

              <Link href={plan.href}>
                <Button
                  className="w-full mb-6"
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>

              <ul className="space-y-3">
                {(plan.features as string[]).map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
