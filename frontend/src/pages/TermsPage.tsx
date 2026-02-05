// path: frontend/src/pages/TermsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../auth/apiClient';
import '../../webapps/design-system/styles.css'; // Import global design system styles
import '../styles.css'; // Import local styles including .spinner-sm

const TermsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!accepted) {
      setError('Debes aceptar los términos y condiciones para continuar');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call backend to accept terms
      await apiClient.post('/auth/accept-terms', { accepted: true });

      // Refresh user data
      await refreshUser();

      // Redirect to home or previous page
      navigate('/');
    } catch (err) {
      console.error('Error accepting terms:', err);
      setError('Error al aceptar los términos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">
            <span>PNP</span>
          </div>
          <div className="header-text">
            <h1>PNPtv!</h1>
            <p>Legal</p>
          </div>
        </div>
        <div className="header-links">
          <a href="/terms" className="active">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>
      </header>

      <main className="container">
        <div className="page-title">
          <h2>Terms of Service</h2>
          <p className="updated">Last updated: January 2025 | Contact: <a href="mailto:support@pnptv.app">support@pnptv.app</a></p>
        </div>

        <section className="section">
          <h2>Reglas básicas de uso</h2>

          <h3>Hangouts (Video Calls):</h3>
          <ul>
            <li>Las salas son espacios sociales entre adultos verificados.</li>
            <li>No se permite grabar pantalla, audio ni redistribuir contenido.</li>
            <li>Cada usuario es responsable de su comportamiento y de lo que comparte.</li>
            <li>El host de cada sala es responsable de su sala.</li>
            <li>PNPtv y PNP Latino TV no se hacen responsables por acciones de terceros.</li>
            <li>Abusos pueden resultar en expulsión o bloqueo de acceso.</li>
          </ul>

          <h3>Videorama (Playlists & Podcasts):</h3>
          <ul>
            <li>Listas/podcasts pueden ser creados por usuarios PRIME.</li>
            <li>Cada creador es responsable del contenido que publica.</li>
            <li>El contenido es solo para adultos.</li>
            <li>ADMIN puede editar o eliminar contenido cuando sea necesario.</li>
          </ul>

          <h3>Responsabilidad (Liability Release):</h3>
          <ul>
            <li>PNPtv y PNP Latino TV son plataformas tecnológicas.</li>
            <li>No somos responsables por acciones, palabras, contenido o conductas de los usuarios.</li>
            <li>Cada usuario participa bajo su propia responsabilidad.</li>
            <li>El uso de la plataforma implica aceptación total de estas condiciones.</li>
          </ul>

          <div className="highlight-box">
            <p>
              Para ver los términos completos, visita: 
              <a 
                href="https://pnptv.app/terms" 
                target="_blank" 
                rel="noopener noreferrer" 
              >
                https://pnptv.app/terms
              </a>
            </p>
          </div>

          <div className="flex items-center mb-6">
            <input
              type="checkbox"
              id="accept-terms"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="accept-terms" className="ml-2 block text-sm text-gray-700">
              Acepto los términos y condiciones de PNPtv
            </label>
          </div>

          {error && (
            <div className="warning-box">
                <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={isLoading}
            className={`button ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="spinner-sm"></div>
                Procesando...
              </span>
            ) : (
              'Aceptar y Continuar'
            )}
          </button>
        </section>
      </main>

      <footer className="footer">
        <p>&copy; 2025 PNPtv! Digital Community | <a href="mailto:support@pnptv.app">support@pnptv.app</a></p>
        <p><a href="/terms">Terms</a> | <a href="/privacy">Privacy</a> | <a href="/">Home</a></p>
      </footer>
    </div>
  );
};

export default TermsPage;