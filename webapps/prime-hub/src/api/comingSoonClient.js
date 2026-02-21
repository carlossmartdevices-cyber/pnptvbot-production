// Coming Soon API client methods
import { apiCall } from './client';

export const comingSoonAPI = {
  /**
   * Sign up for coming soon feature waitlist
   */
  signupWaitlist: async (feature, { email }) => {
    try {
      const response = await apiCall('POST', '/api/coming-soon/waitlist', {
        email,
        feature,
        source: 'web',
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get waitlist count for feature
   */
  getWaitlistCount: async (feature) => {
    try {
      const response = await apiCall('GET', `/api/coming-soon/count/${feature}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${feature} waitlist count`, error);
      return null;
    }
  },

  /**
   * Unsubscribe from waitlist
   */
  unsubscribe: async (feature, { email }) => {
    try {
      const response = await apiCall('POST', '/api/coming-soon/unsubscribe', {
        email,
        feature,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get waitlist statistics (admin)
   */
  getStats: async (feature) => {
    try {
      const response = await apiCall('GET', `/api/coming-soon/stats/${feature}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${feature} stats`, error);
      return null;
    }
  },

  /**
   * Get pending entries (admin)
   */
  getPendingEntries: async (feature, { limit = 100, offset = 0 } = {}) => {
    try {
      const response = await apiCall(
        'GET',
        `/api/coming-soon/pending/${feature}?limit=${limit}&offset=${offset}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch pending entries for ${feature}`, error);
      return null;
    }
  },

  /**
   * Mark entries as notified (admin)
   */
  markAsNotified: async (entryIds) => {
    try {
      const response = await apiCall('POST', '/api/coming-soon/notify', {
        entryIds,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Export waitlist (admin) - returns CSV file
   */
  exportWaitlist: async (feature, { status = 'pending' } = {}) => {
    try {
      const url = `/api/coming-soon/export/${feature}?status=${status}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from header
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `waitlist-${feature}.csv`;

      // Create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, filename };
    } catch (error) {
      throw error;
    }
  },
};
