import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await api.getUser();
      if (response.authenticated) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  function login() {
    // Redirect to Google OAuth
    window.location.href = '/api/auth/google';
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isPro: user?.subscriptionTier === 'PRO',
    login,
    logout,
    refreshUser: checkAuth
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;
