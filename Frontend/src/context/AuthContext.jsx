import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and verify session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const res = await api.get('/auth/me');
          if (res.data?.user) {
            setUser(res.data.user);
          }
        } catch (err) {
          console.warn('Session expired or invalid, logging out.');
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Login handler
  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('token', receivedToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please verify credentials.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Register handler (strictly analyst role)
  const register = async (name, email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('token', receivedToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Change password handler
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return { success: true, message: res.data?.message || 'Password updated' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to update password',
      };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        changePassword,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
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
