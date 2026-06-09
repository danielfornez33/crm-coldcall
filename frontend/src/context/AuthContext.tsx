import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api';

interface Company { id: number; name: string; slug: string; }
interface User { id: number; username: string; role: string; name: string; }

interface AuthCtx {
  user: User | null;
  token: string | null;
  companies: Company[];
  activeCompanyId: number | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(() => {
    const saved = localStorage.getItem('activeCompanyId');
    return saved ? parseInt(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me').then(r => {
        setUser(r.data);
        setCompanies(r.data.companies || []);
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
    
    let companiesData = r.data.companies || [];
    if (companiesData.length === 0 && r.data.user.role === 'super_admin') {
      const companiesRes = await api.get('/auth/companies');
      companiesData = companiesRes.data;
    }
    
    setCompanies(companiesData);
    
    if (companiesData.length > 0) {
      const companyId = companiesData[0].id;
      setActiveCompanyId(companyId);
      localStorage.setItem('activeCompanyId', String(companyId));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeCompanyId');
    setToken(null);
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, companies, activeCompanyId, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);