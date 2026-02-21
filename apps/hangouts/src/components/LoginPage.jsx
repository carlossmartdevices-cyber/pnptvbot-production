import { useEffect, useRef } from 'react';
import { initTelegramLogin } from '../utils/api';

const LoginPage = ({ onAuthSuccess, authLoading }) => {
  const loginRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      initTelegramLogin(loginRef);
    }
  }, [authLoading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-color">
      <div className="w-full max-w-sm p-8 space-y-6 bg-color-2 rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">PNPtv Hangouts</h1>
          <p className="mt-2 text-muted-color">
            Log in with Telegram to continue
          </p>
        </div>
        {authLoading ? (
          <div className="flex justify-center">
            <div className="spinner-lg"></div>
          </div>
        ) : (
          <div ref={loginRef} className="mt-4"></div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
