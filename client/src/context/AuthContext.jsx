import { createContext, useContext, useEffect, useState } from 'react';
import api, { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, restore the session if a token is saved
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  function saveSession({ token, user: nextUser }) {
    tokenStore.set(token);
    setUser(nextUser);
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    saveSession(res.data);
    return res.data.user;
  }

  async function register(role, form) {
    const path = role === 'RECRUITER' ? '/auth/register/recruiter' : '/auth/register/candidate';
    const res = await api.post(path, form);
    saveSession(res.data);
    return res.data.user;
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homePathFor(role) {
  if (role === 'RECRUITER') return '/recruiter';
  if (role === 'ADMIN') return '/admin';
  return '/candidate';
}
