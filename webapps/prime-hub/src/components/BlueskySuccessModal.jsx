/**
 * BlueskySuccessModal.jsx
 * Success confirmation after account creation
 *
 * Shows the user their new Bluesky account info and next steps
 */

import React, { useState } from 'react';
import { CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';

export default function BlueskySuccessModal({ handle, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyHandle = () => {
    if (handle) {
      navigator.clipboard.writeText(handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openBluesky = () => {
    if (handle) {
      const username = handle.replace('@', '').replace('.pnptv.app', '');
      window.open(`https://bsky.app/profile/${username}.pnptv.app`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full transform animate-in zoom-in-95">
        {/* Header with animation */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center">
            <div className="relative">
              <CheckCircle size={48} className="text-white animate-bounce" />
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎉 Welcome to Bluesky!
            </h2>
            <p className="text-gray-600">
              Your account is ready and your profile is already synced
            </p>
          </div>

          {/* Handle display */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-gray-600 font-medium mb-2">Your Bluesky Handle</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm font-mono text-blue-900 font-bold">{handle}</code>
              <button
                onClick={copyHandle}
                className="p-2 hover:bg-blue-100 rounded transition-colors"
                title="Copy handle"
              >
                {copied ? (
                  <CheckCircle size={18} className="text-green-600" />
                ) : (
                  <Copy size={18} className="text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* What's included */}
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-gray-900">Everything is ready:</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                Account created on Bluesky
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                Profile synced from pnptv
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                Ready to post immediately
              </li>
            </ul>
          </div>

          {/* Next steps */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-gray-600 font-medium mb-2">Next Steps</p>
            <ol className="text-sm text-gray-700 space-y-1">
              <li>1. Click "Open Bluesky" below</li>
              <li>2. Verify your account via email</li>
              <li>3. Start posting!</li>
            </ol>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={openBluesky}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <ExternalLink size={16} className="mr-2" />
              Open Bluesky
            </Button>

            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Close
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center">
            Your pnptv profile will stay in sync with Bluesky automatically
          </p>
        </div>
      </div>
    </div>
  );
}
