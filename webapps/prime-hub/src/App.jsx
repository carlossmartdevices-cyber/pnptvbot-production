import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NearbyPage from './pages/NearbyPage';
import HangoutsPage from './pages/HangoutsPage';
import LivePage from './pages/LivePage';
import VideoramaPage from './pages/VideoramaPage';
import FeedPage from './pages/FeedPage';
import WallPage from './pages/WallPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    window.location.replace('/');
    return null;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/nearby" element={<ProtectedRoute><NearbyPage /></ProtectedRoute>} />
        <Route path="/hangouts" element={<ProtectedRoute><HangoutsPage /></ProtectedRoute>} />
        <Route path="/live" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
        <Route path="/videorama" element={<ProtectedRoute><VideoramaPage /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/wall/:userId" element={<ProtectedRoute><WallPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/:partnerId" element={<ProtectedRoute><ConversationPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
