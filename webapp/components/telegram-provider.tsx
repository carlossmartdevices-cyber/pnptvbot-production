'use client';

import { useEffect } from 'react';
import { getTelegramWebApp } from '@/lib/utils';

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const tg = getTelegramWebApp();

    if (tg) {
      // Initialize Telegram WebApp
      tg.ready();

      // Expand the WebApp
      tg.expand();

      // Set theme colors
      tg.setHeaderColor('#a855f7');
      tg.setBackgroundColor('#ffffff');

      // Enable closing confirmation
      tg.enableClosingConfirmation();

      console.log('Telegram WebApp initialized', {
        version: tg.version,
        platform: tg.platform,
        colorScheme: tg.colorScheme,
      });
    }
  }, []);

  return <>{children}</>;
}
