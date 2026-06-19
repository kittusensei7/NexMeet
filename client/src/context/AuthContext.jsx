/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => sessionStorage.getItem('nexmeet_token'));
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('nexmeet_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (error) {
        console.error('Error parsing persistent auth session data:', error);
        sessionStorage.removeItem('nexmeet_token');
        sessionStorage.removeItem('nexmeet_user');
      }
    }
    return null;
  });
  const [loading] = useState(false);

  // Update context state and save credentials to sessionStorage
  const login = (userData, userToken) => {
    setToken(userToken);
    setUser(userData);
    sessionStorage.setItem('nexmeet_token', userToken);
    sessionStorage.setItem('nexmeet_user', JSON.stringify(userData));
  };

  // Clear context state and delete credentials from sessionStorage
  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('nexmeet_token');
    sessionStorage.removeItem('nexmeet_user');
    // Force redirect to login page
    window.location.href = '/login';
  };

  const value = {
    user,
    token,
    isLoggedIn: !!token,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
