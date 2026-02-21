/**
 * PDSStatus.jsx
 * Small status indicator component for displaying PDS status
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, Link2 } from 'lucide-react';

const PDSStatus = ({ userId, compact = false }) => {
  const [pdsInfo, setPdsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/pds/info', {
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch PDS status');

        const data = await response.json();

        if (data.data) {
          setPdsInfo(data.data);
          setStatus(data.data.status);
        } else {
          setStatus('not_configured');
        }
      } catch (error) {
        console.error('PDS status fetch error:', error);
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [userId]);

  if (loading) {
    return compact ? null : <div className="text-gray-400 text-sm">Loading PDS status...</div>;
  }

  if (status === 'not_configured') {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
        <Clock className="w-4 h-4" />
        <span>PDS pending setup</span>
      </div>
    );
  }

  if (status === 'active' && pdsInfo) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-green-700">
          {compact ? 'PDS Ready' : `PDS: ${pdsInfo.pds_handle}`}
        </span>
        {!compact && (
          <a
            href="/pds-setup"
            className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
            title="View PDS details"
          >
            <Link2 className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-red-600`}>
        <AlertCircle className="w-4 h-4" />
        <span>PDS error - retry needed</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
      <Clock className="w-4 h-4" />
      <span>Setting up PDS...</span>
    </div>
  );
};

export default PDSStatus;
