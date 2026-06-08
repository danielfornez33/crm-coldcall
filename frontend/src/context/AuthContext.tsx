import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

interface User { id: number; username: string; role: string; name: string; }

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me').then(r => {
        setUser(r.data);
        localStorage.setItem('user', JSON.stringify(r.data));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', r.data.token);
    localStorage.setItem('user', JSON.stringify(r.data.user));
    setToken(r.data.token);
    setUser(r.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
