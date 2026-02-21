/**
 * PDSSetup.jsx
 * PDS (Personal Data Server) setup wizard and status
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';

const PDSSetup = () => {
  const [loading, setLoading] = useState(true);
  const [pdsInfo, setPdsInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, active, error, pending
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Fetch user's PDS info on component mount
  useEffect(() => {
    const fetchPDSInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/pds/info', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          setPdsInfo(data.data);
          setStatus(data.data.status || 'active');
        } else {
          setStatus('pending');
          setPdsInfo(null);
        }

        setError(null);
      } catch (err) {
        setError(err.message);
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchPDSInfo();
  }, []);

  // Check health status
  const checkHealth = async () => {
    try {
      const response = await fetch('/api/pds/health', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Health check failed');

      const data = await response.json();
      setHealthStatus(data.data);
    } catch (err) {
      setError(`Health check failed: ${err.message}`);
    }
  };

  // Retry provisioning
  const handleRetryProvisioning = async () => {
    try {
      setRetrying(true);
      setError(null);

      const response = await fetch('/api/pds/retry-provision', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setPdsInfo(data.data);
        setStatus('active');
      } else {
        throw new Error(data.error || 'Provisioning retry failed');
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    } finally {
      setRetrying(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    // Show toast or notification
    alert(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600">Setting up your decentralized identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Decentralized Identity</h1>

      {/* Status Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-4">
          {status === 'active' ? (
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
          ) : status === 'pending' ? (
            <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          )}

          <div className="flex-1">
            <h2 className="font-bold text-lg mb-1">
              {status === 'active' && 'Your PDS is Ready'}
              {status === 'pending' && 'Setting Up Your PDS'}
              {status === 'error' && 'PDS Setup Issue'}
            </h2>

            <p className="text-gray-600 mb-3">
              {status === 'active' &&
                'Your Personal Data Server is configured and ready for federation with Bluesky and AT Protocol.'}
              {status === 'pending' &&
                'Your PDS is being provisioned. This typically takes a few seconds to a minute.'}
              {status === 'error' &&
                'There was an issue setting up your PDS. Try retrying below, or contact support.'}
            </p>

            {status === 'error' && error && (
              <p className="text-red-600 text-sm mb-3">{error}</p>
            )}

            {status === 'pending' && (
              <button
                onClick={handleRetryProvisioning}
                disabled={retrying}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : 'Retry Provisioning'}
              </button>
            )}

            {status === 'error' && (
              <button
                onClick={handleRetryProvisioning}
                disabled={retrying}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : 'Retry Setup'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PDS Info Card */}
      {pdsInfo && status === 'active' && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="font-bold text-lg mb-4">PDS Configuration</h3>

          <div className="space-y-4">
            {/* PDS Handle */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                AT Protocol Handle
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pdsInfo.pds_handle || ''}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(pdsInfo.pds_handle, 'Handle')}
                  className="p-2 hover:bg-gray-100 rounded transition"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PDS DID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Decentralized Identifier (DID)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pdsInfo.pds_did || ''}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(pdsInfo.pds_did, 'DID')}
                  className="p-2 hover:bg-gray-100 rounded transition"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PDS Endpoint */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                PDS Endpoint
              </label>
              <input
                type="text"
                value={pdsInfo.pds_endpoint || ''}
                readOnly
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded font-mono text-sm"
              />
            </div>

            {/* UUID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                pnptv UUID
              </label>
              <input
                type="text"
                value={pdsInfo.pnptv_uuid || ''}
                readOnly
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded font-mono text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={checkHealth}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Check Health
            </button>
          </div>

          {/* Health Status */}
          {healthStatus && (
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <h4 className="font-semibold text-sm mb-2">Health Status</h4>
              <div className="space-y-1 text-sm">
                <p>
                  Accessible:{' '}
                  <span className={healthStatus.accessible ? 'text-green-600' : 'text-red-600'}>
                    {healthStatus.accessible ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  Last Verified:{' '}
                  <span className="text-gray-600">
                    {healthStatus.last_verified_at
                      ? new Date(healthStatus.last_verified_at).toLocaleString()
                      : 'Never'}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Information Section */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">About Your PDS</h3>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Personal Data Server (PDS):</strong> A decentralized server that stores your
            data and allows you to participate in the AT Protocol network.
          </p>

          <p>
            <strong>AT Protocol Handle:</strong> Your unique identifier on the AT Protocol network,
            used for federation and social features.
          </p>

          <p>
            <strong>DID (Decentralized Identifier):</strong> A cryptographic identifier that proves
            ownership of your data and identity on decentralized networks.
          </p>

          <p>
            <strong>Privacy:</strong> Your PDS is private to pnptv. We do not share your data with
            external networks by default.
          </p>

          <p>
            <strong>Backup:</strong> Your PDS credentials are encrypted and backed up automatically.
            Never share your private keys with anyone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PDSSetup;
