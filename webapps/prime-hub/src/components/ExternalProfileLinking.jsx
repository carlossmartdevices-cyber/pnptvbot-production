/**
 * ExternalProfileLinking.jsx
 * UI for linking to external Bluesky/Element profiles
 * Two-step flow: 1) Search profile 2) Verify ownership
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AlertCircle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';

export const ExternalProfileLinking = ({ userId, onSuccess }) => {
  const [step, setStep] = useState('input'); // input, verifying, success, error
  const [serviceType, setServiceType] = useState('bluesky');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verification, setVerification] = useState(null);
  const [signedChallenge, setSignedChallenge] = useState('');

  const handleInitiateLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/webapp/profile/external/link', {
        handle,
        serviceType,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to initiate linking');
      }

      setVerification(response.data);
      setStep('verifying');
    } catch (err) {
      setError(err.message);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOwnership = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!signedChallenge.trim()) {
        throw new Error('Please provide the signed challenge');
      }

      const response = await apiClient.post(
        `/api/webapp/profile/external/${verification.profileId}/verify`,
        {
          signedChallenge,
          accessToken: '', // Would be obtained from Bluesky login
        }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Verification failed');
      }

      setStep('success');
      if (onSuccess) {
        onSuccess(response.data);
      }

      // Reset form
      setTimeout(() => {
        setHandle('');
        setSignedChallenge('');
        setStep('input');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getServiceBadge = (type) => {
    switch (type) {
      case 'bluesky':
        return { icon: '🦋', label: 'Bluesky', color: 'bg-blue-50 border-blue-200' };
      case 'element':
        return { icon: '💬', label: 'Element', color: 'bg-green-50 border-green-200' };
      default:
        return { icon: '🔗', label: 'Unknown', color: 'bg-gray-50 border-gray-200' };
    }
  };

  const serviceBadge = getServiceBadge(serviceType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{serviceBadge.icon}</span>
          Link {serviceBadge.label} Profile
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Step 1: Enter handle */}
        {step === 'input' && (
          <form onSubmit={handleInitiateLink} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Link your {serviceBadge.label} account to your pnptv profile. Your posts and
              followers will be visible to you in your pnptv feed.
            </p>

            {/* Service type selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Service</label>
              <div className="flex gap-2">
                {['bluesky', 'element'].map((type) => {
                  const badge = getServiceBadge(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setServiceType(type);
                        setError(null);
                      }}
                      className={`flex-1 px-3 py-2 rounded border-2 text-sm font-medium transition ${
                        serviceType === type
                          ? `${badge.color} border-current`
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {badge.icon} {badge.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Handle input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {serviceType === 'bluesky' ? 'Bluesky Handle' : 'Element User ID'}
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setError(null);
                }}
                placeholder={
                  serviceType === 'bluesky' ? 'alice.bsky.social' : '@alice:element.io'
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={!handle.trim() || loading}
                className="flex-1"
              >
                {loading ? 'Searching...' : 'Continue'}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Verify ownership */}
        {step === 'verifying' && verification && (
          <form onSubmit={handleVerifyOwnership} className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Clock size={18} />
                Prove You Own This Profile
              </h4>
              <p className="text-sm text-gray-700 mb-4">
                We found your {serviceBadge.label} profile:
              </p>
              <p className="text-sm font-medium">
                {serviceBadge.icon} {verification.externalUsername}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {verification.profileName}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Verification Challenge
              </label>
              <div className="p-3 bg-gray-50 border rounded font-mono text-xs break-all mb-2">
                {verification.challenge}
              </div>
              <p className="text-xs text-gray-600 mb-3">
                This challenge expires in{' '}
                {Math.round(
                  (new Date(verification.challengeExpiresAt).getTime() - Date.now()) / 60000
                )}{' '}
                minutes.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Signed Challenge</label>
              <textarea
                value={signedChallenge}
                onChange={(e) => {
                  setSignedChallenge(e.target.value);
                  setError(null);
                }}
                placeholder="Paste the signed challenge here (sign the challenge with your private key)"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs resize-none"
                rows={4}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                How to sign: Use your {serviceBadge.label} client to sign the challenge above
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('input');
                  setSignedChallenge('');
                  setError(null);
                }}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!signedChallenge.trim() || loading}
                className="flex-1"
              >
                {loading ? 'Verifying...' : 'Verify & Link'}
              </Button>
            </div>
          </form>
        )}

        {/* Success message */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Profile Linked Successfully!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Your {serviceBadge.label} account is now linked to your pnptv profile.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <AlertCircle size={48} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Failed to Link Profile</h3>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStep('input');
                setError(null);
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExternalProfileLinking;
