import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Toast.css';

/**
 * Toast notification component
 * @param {Object} props
 * @param {string} props.id - Unique identifier
 * @param {string} props.type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} props.message - Toast message text
 * @param {number} props.duration - Auto-hide duration in ms (0 = no auto-hide)
 * @param {Function} props.onClose - Callback when toast closes
 */
export function Toast({ id, type = 'info', message, duration = 5000, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
  };

  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="assertive">
      <div className="toast-icon">{icons[type]}</div>
      <div className="toast-content">{message}</div>
      <button
        className="toast-close"
        onClick={() => onClose?.(id)}
        aria-label="Cerrar notificación"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * Toast Container - renders all active toasts
 */
export function ToastContainer({ toasts, onClose }) {
  return (
    <div className="toast-container" role="region" aria-label="Notificaciones">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

export default Toast;
