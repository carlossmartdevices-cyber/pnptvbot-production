import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NearbyPage from './pages/NearbyPage';
import HangoutsPage from './pages/HangoutsPage';
import LivePage from './pages/LivePage';
import VideoramaPage from './pages/VideoramaPage';
import MediaLibraryPage from './pages/MediaLibraryPage';
import FeedPage from './pages/FeedPage';
import WallPage from './pages/WallPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPostsPage from './pages/admin/AdminPostsPage';
import AdminHangoutsPage from './pages/admin/AdminHangoutsPage';
import AdminMediaPage from './pages/admin/AdminMediaPage';
import AdminRadioPage from './pages/admin/AdminRadioPage';

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
    // Redirect to the single HTML login page (not the React SPA route)
    window.location.replace('/');
    return null;
  }

  return children;
}

function AdminRoute({ children }) {
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

  if (!['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/nearby" element={<ProtectedRoute><NearbyPage /></ProtectedRoute>} />
        <Route path="/hangouts" element={<ProtectedRoute><HangoutsPage /></ProtectedRoute>} />
        <Route path="/live" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
        <Route path="/videorama" element={<VideoramaPage />} />
        <Route path="/media" element={<ProtectedRoute><MediaLibraryPage /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/wall/:userId" element={<ProtectedRoute><WallPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/:partnerId" element={<ProtectedRoute><ConversationPage /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/posts" element={<AdminRoute><AdminPostsPage /></AdminRoute>} />
        <Route path="/admin/hangouts" element={<AdminRoute><AdminHangoutsPage /></AdminRoute>} />
        <Route path="/admin/media" element={<AdminRoute><AdminMediaPage /></AdminRoute>} />
        <Route path="/admin/radio" element={<AdminRoute><AdminRadioPage /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
