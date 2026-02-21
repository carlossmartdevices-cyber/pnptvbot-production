import React from 'react';
import Layout from '../components/Layout';
import { Film } from 'lucide-react';

export default function VideoramaPage() {
  return (
    <Layout>
      <div className="section-label">Videorama</div>
      <div className="feature-page">
        <iframe
          className="feature-iframe"
          src="/videorama"
          title="Videorama"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </Layout>
  );
}
