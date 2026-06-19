import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import Lobby from './pages/Lobby/Lobby';
import Room from './pages/Room/Room';
import './App.css';

/**
 * ProtectedRoute Wrapper
 * Restricts access to authenticated users only.
 */
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-small"></div>
      </div>
    );
  }

  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

/**
 * App Component
 * Defines Router switch paths mapping to screens.
 */
function App() {
  useEffect(() => {
    const theme = localStorage.getItem('nexmeet_theme');
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    const handlePopState = () => {
      window.location.reload();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private Meeting Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Private Meeting Routes: meeting links should prioritize /lobby/:roomId */}
        <Route
          path="/lobby/:roomId"
          element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute>
              <Room />
            </ProtectedRoute>
          }
        />

        {/* Root Fallback Redirection */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
