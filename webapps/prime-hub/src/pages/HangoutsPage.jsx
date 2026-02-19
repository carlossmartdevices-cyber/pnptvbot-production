import React from 'react';
import Layout from '../components/Layout';
import { Users } from 'lucide-react';

export default function HangoutsPage() {
  return (
    <Layout>
      <div className="section-label">Hangouts</div>
      <div className="feature-page">
        <iframe
          className="feature-iframe"
          src="/hangouts"
          title="Hangouts"
          allow="camera; microphone; display-capture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </Layout>
  );
}
