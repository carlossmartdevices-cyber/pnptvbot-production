// path: frontend/src/pages/TermsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../auth/apiClient';

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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Términos y Condiciones - PNPtv
        </h1>

        <div className="prose max-w-none mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Reglas básicas de uso
          </h2>

          <h3 className="text-lg font-medium text-gray-600 mb-3">
            Hangouts (Video Calls):
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-600">
            <li>Las salas son espacios sociales entre adultos verificados.</li>
            <li>No se permite grabar pantalla, audio ni redistribuir contenido.</li>
            <li>Cada usuario es responsable de su comportamiento y de lo que comparte.</li>
            <li>El host de cada sala es responsable de su sala.</li>
            <li>PNPtv y PNP Latino TV no se hacen responsables por acciones de terceros.</li>
            <li>Abusos pueden resultar en expulsión o bloqueo de acceso.</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-600 mb-3">
            Videorama (Playlists & Podcasts):
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-600">
            <li>Listas/podcasts pueden ser creados por usuarios PRIME.</li>
            <li>Cada creador es responsable del contenido que publica.</li>
            <li>El contenido es solo para adultos.</li>
            <li>ADMIN puede editar o eliminar contenido cuando sea necesario.</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-600 mb-3">
            Responsabilidad (Liability Release):
          </h3>
          <ul className="list-disc pl-6 mb-6 text-gray-600">
            <li>PNPtv y PNP Latino TV son plataformas tecnológicas.</li>
            <li>No somos responsables por acciones, palabras, contenido o conductas de los usuarios.</li>
            <li>Cada usuario participa bajo su propia responsabilidad.</li>
            <li>El uso de la plataforma implica aceptación total de estas condiciones.</li>
          </ul>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Para ver los términos completos, visita: 
              <a 
                href="https://pnptv.app/terms" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline"
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
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={isLoading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            ) : (
              'Aceptar y Continuar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;