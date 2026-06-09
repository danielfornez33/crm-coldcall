import { type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: string }) {
  const { user, loading, activeCompanyId } = useAuth();
  const params = useParams();

  if (loading) return <div className="loading">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;

  const urlCompanyId = parseInt(params.companyId || '');
  if (urlCompanyId && activeCompanyId && urlCompanyId !== activeCompanyId) {
    return <Navigate to={`/companies/${activeCompanyId}/${user.role === 'supervisor' ? 'supervisor' : 'operator'}`} />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/login" />;
  }

  return children;
}