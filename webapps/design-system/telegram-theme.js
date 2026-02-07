// Telegram Mini App theme bridge
// Detects Telegram WebApp context and maps theme colors to CSS custom properties.
// Falls back to a dark theme when running in a regular browser.

(function initTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  const root = document.documentElement;

  if (tg) {
    // Running inside Telegram Mini App
    const tp = tg.themeParams || {};
    const set = (k, v) => { if (v) root.style.setProperty(k, v); };

    set('--tg-bg', tp.bg_color);
    set('--tg-text', tp.text_color);
    set('--tg-hint', tp.hint_color);
    set('--tg-link', tp.link_color);
    set('--tg-button', tp.button_color);
    set('--tg-button-text', tp.button_text_color);
    set('--tg-secondary-bg', tp.secondary_bg_color);

    tg.expand();
    tg.ready();
  } else {
    // Browser fallback — dark theme
    root.style.setProperty('--tg-bg', '#1c1c1e');
    root.style.setProperty('--tg-text', '#f5f5f7');
    root.style.setProperty('--tg-hint', '#8e8e93');
    root.style.setProperty('--tg-link', '#0a84ff');
    root.style.setProperty('--tg-button', '#0a84ff');
    root.style.setProperty('--tg-button-text', '#ffffff');
    root.style.setProperty('--tg-secondary-bg', '#2c2c2e');
  }
})();

/** Trigger haptic feedback when inside Telegram */
export function haptic(type = 'light') {
  const hf = window.Telegram?.WebApp?.HapticFeedback;
  if (!hf) return;
  if (type === 'light' || type === 'medium' || type === 'heavy') {
    hf.impactOccurred(type);
  } else if (type === 'success' || type === 'error' || type === 'warning') {
    hf.notificationOccurred(type);
  }
}
