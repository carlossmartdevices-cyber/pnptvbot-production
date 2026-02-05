export const getTelegramWebApp = () => {
  try {
    return window.Telegram?.WebApp || null;
  } catch (error) {
    console.error('Telegram WebApp unavailable:', error);
    return null;
  }
};

export const isTelegramWebApp = () => Boolean(getTelegramWebApp());

export const getTelegramUser = () => {
  try {
    const webApp = getTelegramWebApp();
    if (!webApp) return null;

    const user = webApp.initDataUnsafe?.user;
    if (!user?.id) return null;

    const displayName = user.username
      ? `@${user.username}`
      : user.first_name || user.last_name || 'Anonymous';

    return {
      id: user.id,
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      languageCode: user.language_code || null,
      displayName,
      initData: webApp.initData || null,
      isTelegram: true,
    };
  } catch (error) {
    console.error('Failed to read Telegram user:', error);
    return null;
  }
};

export const initTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  if (!webApp) return false;

  try {
    webApp.expand();
    webApp.ready();
    return true;
  } catch (error) {
    console.error('Telegram WebApp init failed:', error);
    return false;
  }
};
