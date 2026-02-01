import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Lobby from './components/Lobby';
import { getQueryParams } from './utils/url';
import { getTelegramUser, initTelegramWebApp } from './utils/telegram';

const CallRoom = lazy(() => import('./components/CallRoom'));

function App() {
  const params = useMemo(() => getQueryParams(), []);
  const roleParam = (params.role || '').toUpperCase();
  const [telegramUser, setTelegramUser] = useState(null);

  useEffect(() => {
    const ok = initTelegramWebApp();
    if (!ok) return;
    setTelegramUser(getTelegramUser());
  }, []);

  const isCallMode = Boolean(params.room && params.token && params.uid);

  if (isCallMode) {
    return (
      <Suspense
        fallback={
          <div className="app">
            <div className="bg" />
            <div className="loading">
              <div className="spinner" />
              <div className="muted">Loading call...</div>
            </div>
          </div>
        }
      >
        <CallRoom params={params} telegramUser={telegramUser} />
      </Suspense>
    );
  }

  return <Lobby telegramUser={telegramUser} role={roleParam} />;
}

export default App;
