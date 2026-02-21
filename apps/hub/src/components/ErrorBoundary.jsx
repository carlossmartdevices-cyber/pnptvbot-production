import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import './ErrorBoundary.css';

/**
 * Global Error Boundary Component
 * Catches unhandled React errors and displays user-friendly error page
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    // Clear error state and reload the page
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Force a full page reload
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            {/* Error Icon */}
            <div className="error-icon-wrapper">
              <AlertTriangle size={48} className="error-icon" />
            </div>

            {/* Error Message */}
            <h1 className="error-title">Algo salió mal</h1>
            <p className="error-message">
              Encontramos un problema inesperado. Por favor intenta recargar la página.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="error-details">
                <details className="error-details-toggle">
                  <summary>Detalles del error (desarrollo)</summary>
                  <div className="error-details-content">
                    <p>
                      <strong>Error:</strong> {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <p>
                        <strong>Component Stack:</strong>
                        <pre>{this.state.errorInfo.componentStack}</pre>
                      </p>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Reload Button */}
            <button onClick={this.handleReload} className="error-reload-btn">
              <RotateCcw size={20} />
              <span>Recargar</span>
            </button>

            {/* Help Text */}
            <p className="error-help-text">
              Si el problema persiste, por favor contacta con soporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
