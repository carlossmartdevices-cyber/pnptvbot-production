/**
 * ExternalProfileCard.jsx
 * Displays linked external profile information with privacy controls
 * Used in profile settings and profile card display
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AlertCircle, Shield, Link2, LinkOff, Settings } from 'lucide-react';

export const ExternalProfileCard = ({
  profile,
  onUnlink,
  onUpdateSettings,
  isVerified = false,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    showOnProfile: profile?.show_on_profile ?? true,
    showFollowerCount: profile?.show_follower_count ?? true,
    showActivityStatus: profile?.show_activity_status ?? true,
    publicLinking: profile?.public_linking ?? false,
  });

  const handleUnlink = async () => {
    if (window.confirm('Unlink this external profile?')) {
      setLoading(true);
      try {
        await onUnlink(profile.id);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await onUpdateSettings(profile.id, settings);
      setShowSettings(false);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (serviceType) => {
    switch (serviceType) {
      case 'bluesky':
        return '🦋';
      case 'element':
        return '💬';
      default:
        return '🔗';
    }
  };

  const getServiceColor = (serviceType) => {
    switch (serviceType) {
      case 'bluesky':
        return 'bg-blue-50 border-blue-200';
      case 'element':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className={`${getServiceColor(profile.service_type)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Service icon */}
            <div className="text-2xl">{getServiceIcon(profile.service_type)}</div>

            {/* Profile info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base truncate">
                  {profile.profile_name || profile.external_username}
                </CardTitle>
                {isVerified && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full text-xs text-green-700">
                    <Shield size={12} />
                    Verified
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">@{profile.external_username}</p>
            </div>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white rounded-lg transition"
            title="Privacy settings"
          >
            <Settings size={18} className="text-gray-600" />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Verification warning if not verified */}
        {!isVerified && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>This profile has not been verified yet</span>
          </div>
        )}

        {/* Profile details */}
        <div className="space-y-2 text-sm mb-4">
          {profile.profile_bio && (
            <p className="text-gray-700 line-clamp-2">{profile.profile_bio}</p>
          )}

          {profile.show_follower_count && profile.follower_count && (
            <div className="flex gap-4 text-gray-600">
              <span>
                <strong>{profile.follower_count.toLocaleString()}</strong> followers
              </span>
            </div>
          )}

          {profile.last_synced_at && (
            <p className="text-xs text-gray-500">
              Last synced: {new Date(profile.last_synced_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 space-y-3">
            <h4 className="font-medium text-sm mb-3">Privacy Settings</h4>

            {/* Show on profile */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showOnProfile}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showOnProfile: e.target.checked,
                  }))
                }
                className="rounded"
              />
              <span className="text-sm">Show on my profile card</span>
            </label>

            {/* Show follower count */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showFollowerCount}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showFollowerCount: e.target.checked,
                  }))
                }
                className="rounded"
              />
              <span className="text-sm">Show follower count</span>
            </label>

            {/* Show activity status */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showActivityStatus}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showActivityStatus: e.target.checked,
                  }))
                }
                className="rounded"
              />
              <span className="text-sm">Show activity status</span>
            </label>

            {/* Public linking */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.publicLinking}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    publicLinking: e.target.checked,
                  }))
                }
                className="rounded"
              />
              <span className="text-sm">Allow others to see this linking</span>
            </label>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSettings(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnlink}
            disabled={loading}
            className="flex-1 text-red-600 hover:text-red-700"
          >
            <LinkOff size={14} className="mr-1" />
            Unlink
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExternalProfileCard;
