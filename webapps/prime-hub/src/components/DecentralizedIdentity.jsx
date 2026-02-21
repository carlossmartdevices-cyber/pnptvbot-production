/**
 * DecentralizedIdentity.jsx
 * Profile section for managing decentralized identity
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock, Copy, ExternalLink, RefreshCw } from 'lucide-react';

const DecentralizedIdentity = () => {
  const [pdsInfo, setPdsInfo] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPDSInfo();
  }, []);

  const fetchPDSInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pds/info', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch PDS info');

      const data = await response.json();

      if (data.data) {
        setPdsInfo(data.data);
        setStatus(data.data.status);
        setError(null);
      } else {
        setStatus('pending');
        setPdsInfo(null);
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      const response = await fetch('/api/pds/retry-provision', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setPdsInfo(data.data);
        setStatus('active');
        setError(null);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const response = await fetch('/api/pds/health', {
        credentials: 'include'
      });

      const data = await response.json();
      setHealthStatus(data.data);
    } catch (err) {
      setError(`Health check failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading PDS information...</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    active: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      title: 'Active',
      description: 'Your PDS is configured and ready'
    },
    pending: {
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      title: 'Setting Up',
      description: 'Your PDS is being provisioned'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      title: 'Error',
      description: 'There was an issue with your PDS'
    }
  };

  const config = statusConfig[status] || statusConfig.error;
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className={`p-6 ${config.bg} border-b ${config.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon className={`w-6 h-6 ${config.color} flex-shrink-0 mt-1`} />
            <div>
              <h3 className="font-bold text-lg">Decentralized Identity</h3>
              <p className={`text-sm ${config.color}`}>{config.title}</p>
              <p className="text-sm text-gray-600 mt-1">{config.description}</p>
            </div>
          </div>

          {status === 'error' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 whitespace-nowrap text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          )}

          {status === 'pending' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Setting up...' : 'Setup'}
            </button>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Overview
          </button>
          {status === 'active' && (
            <>
              <button
                onClick={() => setActiveTab('config')}
                className={`py-3 font-medium text-sm border-b-2 transition ${
                  activeTab === 'config'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Configuration
              </button>
              <button
                onClick={() => setActiveTab('health')}
                className={`py-3 font-medium text-sm border-b-2 transition ${
                  activeTab === 'health'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Health
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">What is a PDS?</h4>
              <p className="text-sm text-gray-600 mb-3">
                A Personal Data Server (PDS) is a decentralized server that stores your profile
                data and enables you to participate in federated social networks like Bluesky and
                the AT Protocol ecosystem.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Your Benefits</h4>
              <ul className="text-sm text-gray-600 space-y-2 ml-4">
                <li className="list-disc">Own and control your digital identity</li>
                <li className="list-disc">Interoperate with AT Protocol applications</li>
                <li className="list-disc">Portable identity across platforms</li>
                <li className="list-disc">Encrypted credential storage</li>
                <li className="list-disc">Automatic backup and recovery</li>
              </ul>
            </div>

            {status === 'active' && pdsInfo && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <a
                  href="/pds-setup"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2"
                >
                  View Full Configuration <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && status === 'active' && pdsInfo && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                AT Protocol Handle
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono">
                  {pdsInfo.pds_handle}
                </code>
                <button
                  onClick={() => copyToClipboard(pdsInfo.pds_handle)}
                  className="p-2 hover:bg-gray-100 rounded transition"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                Decentralized Identifier (DID)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono break-all">
                  {pdsInfo.pds_did}
                </code>
                <button
                  onClick={() => copyToClipboard(pdsInfo.pds_did)}
                  className="p-2 hover:bg-gray-100 rounded transition flex-shrink-0"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                PDS Endpoint
              </label>
              <code className="block px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono break-all">
                {pdsInfo.pds_endpoint}
              </code>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                pnptv UUID
              </label>
              <code className="block px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono">
                {pdsInfo.pnptv_uuid}
              </code>
            </div>
          </div>
        )}

        {activeTab === 'health' && status === 'active' && (
          <div className="space-y-4">
            <button
              onClick={handleHealthCheck}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Check Health
            </button>

            {healthStatus && (
              <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                <h4 className="font-semibold text-sm mb-3">Health Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={healthStatus.accessible ? 'text-green-600' : 'text-red-600'}
                    >
                      {healthStatus.accessible ? 'Accessible' : 'Unreachable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Verification Status:</span>
                    <span className="text-gray-700">{healthStatus.verification_status}</span>
                  </div>
                  {healthStatus.last_verified_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Verified:</span>
                      <span className="text-gray-700">
                        {new Date(healthStatus.last_verified_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DecentralizedIdentity;
