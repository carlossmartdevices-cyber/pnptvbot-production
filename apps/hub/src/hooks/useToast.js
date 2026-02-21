import { useState, useCallback } from 'react';

/**
 * Custom hook for managing toast notifications
 * Returns: { toasts, showToast, closeToast, clearToasts }
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now().toString();

    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        duration,
      },
    ]);

    return id;
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    closeToast,
    clearToasts,
  };
}

export default useToast;
