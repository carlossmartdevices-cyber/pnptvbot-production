import React from 'react';
import Layout from '../components/Layout';
import { MapPin } from 'lucide-react';

export default function NearbyPage() {
  return (
    <Layout>
      <div className="section-label">Nearby</div>
      <div className="feature-page">
        <iframe
          className="feature-iframe"
          src="/nearby"
          title="Nearby"
          allow="geolocation"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </Layout>
  );
}
