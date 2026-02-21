/**
 * BlueskySetupCard.jsx
 * One-click Bluesky setup card for dashboard
 *
 * UX Philosophy: Zero friction, maximum magic
 * - Button says "Create Bluesky Account"
 * - Click button
 * - Account ready in <5 seconds
 * - Profile auto-synced from pnptv
 * - Can immediately start posting
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, Loader, Zap, Copy } from 'lucide-react';
import {
  setupBlueskyAccount,
  getBlueskyStatus,
  disconnectBluesky
} from '../api/blueskyClient';
import BlueskySuccessModal from './BlueskySuccessModal';

export default function BlueskySetupCard() {
  const [status, setStatus] = useState('idle'); // idle, loading, success, error, connected
  const [blueskyHandle, setBlueskyHandle] = useState(null);
  const [blueskyDid, setBlueskyDid] = useState(null);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load current status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await getBlueskyStatus();
      if (response.success && response.data.setup) {
        setBlueskyHandle(response.data.handle);
        setBlueskyDid(response.data.did);
        setStatus('connected');
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
      const result = await setupBlueskyAccount();

      if (result.success) {
        setBlueskyHandle(result.blueskyHandle);
        setBlueskyDid(result.blueskyDid);
        setStatus('success');
        setShowSuccess(true);

        // Hide success modal after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setStatus('connected');
        }, 5000);
      } else {
        setError(result.error?.message || 'Setup failed');
        setStatus('error');
      }

    } catch (err) {
      setError(err.message || 'Failed to create Bluesky account');
      setStatus('error');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your Bluesky account from pnptv?')) {
      return;
    }

    try {
      setStatus('loading');
      const result = await disconnectBluesky();

      if (result.success) {
        setBlueskyHandle(null);
        setBlueskyDid(null);
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

  const openBluesky = () => {
    if (blueskyHandle) {
      const username = blueskyHandle.replace('@', '').replace('.pnptv.app', '');
      window.open(`https://bsky.app/profile/${username}.pnptv.app`, '_blank');
    }
  };

  // Connected state - show account info
  if (status === 'connected' && blueskyHandle) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🦋</div>
              <CardTitle className="text-blue-900">Bluesky</CardTitle>
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <CheckCircle size={14} />
                Connected
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-100 p-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">Your Bluesky Account</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-blue-900">{blueskyHandle}</code>
                <button
                  onClick={() => copyToClipboard(blueskyHandle)}
                  className="p-1 hover:bg-blue-200 rounded transition-colors"
                  title="Copy handle"
                >
                  {copied ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} className="text-blue-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={openBluesky}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Zap size={16} className="mr-2" />
                Open Bluesky
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
              ✨ Your profile is auto-synced with pnptv
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🦋</div>
            <CardTitle className="text-blue-900">Bluesky</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader size={32} className="text-blue-600 animate-spin mb-3" />
            <p className="text-sm text-gray-600 font-medium">Creating your account...</p>
            <p className="text-xs text-gray-500 mt-1">This takes about 5 seconds</p>
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
            <div className="text-2xl">🦋</div>
            <CardTitle className="text-red-900">Bluesky</CardTitle>
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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

  // Default idle state - the one-click button!
  return (
    <>
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-md transition-shadow">
        <CardHeader className="border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🦋</div>
            <div className="flex-1">
              <CardTitle className="text-blue-900">Bluesky</CardTitle>
              <p className="text-xs text-blue-700 mt-0.5 font-medium">Join the decentralized social web</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Features list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Zap size={16} className="text-blue-600" />
                <span>One click to get started</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle size={16} className="text-green-600" />
                <span>Your profile syncs automatically</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-4 h-4 rounded-full bg-blue-600" />
                <span>You own your data on Bluesky</span>
              </div>
            </div>

            {/* Magic button! */}
            <Button
              onClick={handleSetupClick}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base"
            >
              <Zap size={18} className="mr-2" />
              Create Bluesky Account
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Takes less than 5 seconds • No extra steps required
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Success modal */}
      {showSuccess && (
        <BlueskySuccessModal
          handle={blueskyHandle}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </>
  );
}
