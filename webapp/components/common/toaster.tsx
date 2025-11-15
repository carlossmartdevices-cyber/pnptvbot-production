'use client';

import { useEffect, useState } from 'react';

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
};

let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

export function toast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { ...toast, id };
  toasts = [...toasts, newToast];
  listeners.forEach((listener) => listener(toasts));

  if (toast.duration !== Infinity) {
    setTimeout(() => {
      dismiss(id);
    }, toast.duration || 3000);
  }

  return id;
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((listener) => listener(toasts));
}

export function Toaster() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setCurrentToasts);
    return () => {
      const index = listeners.indexOf(setCurrentToasts);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <div className="fixed bottom-0 right-0 z-50 max-h-screen w-full md:max-w-[420px] p-4 space-y-4">
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto w-full rounded-lg border p-4 shadow-lg transition-all animate-fadeIn",
            {
              "bg-background border-border": t.variant === 'default' || !t.variant,
              "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800":
                t.variant === 'success',
              "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800":
                t.variant === 'error',
              "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800":
                t.variant === 'warning',
            }
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {t.title && (
                <div className="font-semibold text-sm mb-1">{t.title}</div>
              )}
              {t.description && (
                <div className="text-sm opacity-90">{t.description}</div>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
