import React from 'react';
import Layout from '../components/Layout';
import { Radio } from 'lucide-react';

export default function LivePage() {
  return (
    <Layout>
      <div className="section-label">PNP Live</div>
      <div className="feature-page">
        <iframe
          className="feature-iframe"
          src="/live"
          title="Live"
          allow="camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </Layout>
  );
}
