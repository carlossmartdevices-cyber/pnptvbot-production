/**
 * ElementSetupCard.jsx
 * Element (Matrix) setup card for dashboard
 *
 * UX Philosophy: Seamless and automatic
 * - Auto-created after Bluesky setup
 * - Shows connection status
 * - Can manually trigger setup if needed
 * - Allows disconnection
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, Loader, Zap, Copy, ExternalLink } from 'lucide-react';
import {
  setupElementAccount,
  getElementStatus,
  disconnectElement
} from '../api/elementClient';

export default function ElementSetupCard() {
  const [status, setStatus] = useState('idle'); // idle, loading, success, error, connected
  const [matrixUserId, setMatrixUserId] = useState(null);
  const [matrixUsername, setMatrixUsername] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);

  // Load current status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await getElementStatus();
      if (response.success && response.data.setup) {
        setMatrixUserId(response.data.matrixUserId);
        setMatrixUsername(response.data.matrixUsername);
        setDisplayName(response.data.displayName);
        setVerified(response.data.verified);
        setStatus('connected');
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.error('Error loading status:', err);
      // Fail gracefully - just show setup button
      setStatus('idle');
    }
  };

  const handleSetupClick = async () => {
    setStatus('loading');
    setError(null);

    try {
      const result = await setupElementAccount();

      if (result.success) {
        setMatrixUserId(result.matrixUserId);
        setMatrixUsername(result.matrixUsername);
        setDisplayName(result.displayName);
        setStatus('success');

        // Transition to connected state after 3 seconds
        setTimeout(() => {
          setStatus('connected');
        }, 3000);
      } else {
        setError(result.error?.message || 'Setup failed');
        setStatus('error');
      }

    } catch (err) {
      setError(err.message || 'Failed to create Element account');
      setStatus('error');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your Element account from pnptv?')) {
      return;
    }

    try {
      setStatus('loading');
      const result = await disconnectElement();

      if (result.success) {
        setMatrixUserId(null);
        setMatrixUsername(null);
        setDisplayName(null);
        setVerified(false);
        setStatus('idle');
      }

    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openElement = () => {
    if (matrixUserId) {
      // Element app URL format
      window.open(`https://element.pnptv.app/#/user/${matrixUserId}`, '_blank');
    }
  };

  // Connected state - show account info
  if (status === 'connected' && matrixUserId) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="border-b border-green-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">💬</div>
              <CardTitle className="text-green-900">Element</CardTitle>
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <CheckCircle size={14} />
                Connected
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-green-100 p-4">
              <p className="text-sm text-green-900 font-semibold mb-2">Your Element Account</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-green-900 break-all">{matrixUserId}</code>
                <button
                  onClick={() => copyToClipboard(matrixUserId)}
                  className="p-1 hover:bg-green-200 rounded transition-colors flex-shrink-0"
                  title="Copy user ID"
                >
                  {copied ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} className="text-green-600" />
                  )}
                </button>
              </div>
            </div>

            {displayName && (
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-green-700 font-medium mb-1">Display Name</p>
                <p className="text-sm text-green-900">{displayName}</p>
              </div>
            )}

            {verified && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 px-3 py-2 rounded">
                <CheckCircle size={14} />
                <span>Account verified</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={openElement}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ExternalLink size={16} className="mr-2" />
                Open Element
              </Button>

              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="text-red-600 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              💬 Decentralized messaging with Element
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="border-b border-green-100">
          <div className="flex items-center gap-3">
            <div className="text-2xl">💬</div>
            <CardTitle className="text-green-900">Element</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader size={32} className="text-green-600 animate-spin mb-3" />
            <p className="text-sm text-gray-600 font-medium">Setting up your account...</p>
            <p className="text-xs text-gray-500 mt-1">This takes about 3 seconds</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (status === 'success' && matrixUserId) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="border-b border-green-100">
          <div className="flex items-center gap-3">
            <div className="text-2xl">💬</div>
            <CardTitle className="text-green-900">Element</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-green-100 p-4 flex items-start gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">Account Created!</p>
                <p className="text-xs text-green-800 mt-1">Your Element account is ready to use</p>
              </div>
            </div>

            <div className="rounded-lg bg-green-50 p-3 border border-green-200">
              <p className="text-xs text-green-700 font-medium mb-2">Your Matrix ID</p>
              <code className="text-xs font-mono text-green-900 break-all">{matrixUserId}</code>
            </div>

            <Button
              onClick={openElement}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <ExternalLink size={16} className="mr-2" />
              Open Element
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Auto-created with your pnptv profile
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
        <CardHeader className="border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="text-2xl">💬</div>
            <CardTitle className="text-red-900">Element</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-red-100 p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">Setup Failed</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSetupClick}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Try Again
              </Button>

              <Button
                onClick={() => setStatus('idle')}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default idle state - setup button
  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white hover:shadow-md transition-shadow">
      <CardHeader className="border-b border-green-100">
        <div className="flex items-center gap-3">
          <div className="text-3xl">💬</div>
          <div className="flex-1">
            <CardTitle className="text-green-900">Element</CardTitle>
            <p className="text-xs text-green-700 mt-0.5 font-medium">Decentralized messaging & chat</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Features list */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Zap size={16} className="text-green-600" />
              <span>Auto-created after Bluesky setup</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle size={16} className="text-green-600" />
              <span>Send encrypted messages</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-4 h-4 rounded-full bg-green-600" />
              <span>Join community rooms</span>
            </div>
          </div>

          {/* Setup button */}
          <Button
            onClick={handleSetupClick}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-base"
          >
            <Zap size={18} className="mr-2" />
            Create Element Account
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Takes less than 3 seconds • Often auto-created
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
