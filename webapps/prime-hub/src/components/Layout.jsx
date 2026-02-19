import React from 'react';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from './chat/ChatWidget';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        {children}
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
