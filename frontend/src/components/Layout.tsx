import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, companies } = useAuth();
  const loc = useLocation();
  const params = useParams();
  const companyId = params.companyId;
  const isSupervisor = user?.role === 'supervisor';
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    if (companyId && companies.length > 0) {
      const company = companies.find(c => c.id === parseInt(companyId));
      setCompanyName(company?.name || '');
    }
  }, [companyId, companies]);

  return (
    <div className="app-layout">
      <nav className="nav">
        <div className="nav-brand">{companyName || 'CRM'}</div>
        <div className="nav-links">
           {isSupervisor && (
             <>
               <Link to={`/companies/${companyId}/supervisor`} className={loc.pathname === `/companies/${companyId}/supervisor` ? 'active' : ''}>Dashboard</Link>
               <Link to={`/companies/${companyId}/supervisor/clientes`} className={loc.pathname.includes('clientes') ? 'active' : ''}>Clientes</Link>
               <Link to={`/companies/${companyId}/supervisor/importar`} className={loc.pathname === `/companies/${companyId}/supervisor/importar` ? 'active' : ''}>Importar</Link>
               <Link to={`/companies/${companyId}/supervisor/operadores`} className={loc.pathname === `/companies/${companyId}/supervisor/operadores` ? 'active' : ''}>Operadores</Link>
               <Link to={`/companies/${companyId}/supervisor/historial`} className={loc.pathname === `/companies/${companyId}/supervisor/historial` ? 'active' : ''}>Historial</Link>
             </>
           )}
          {!isSupervisor && (
            <>
              <Link to={`/companies/${companyId}/operator`} className={loc.pathname === `/companies/${companyId}/operator` ? 'active' : ''}>Mis llamadas</Link>
              <Link to={`/companies/${companyId}/operator/historial`} className={loc.pathname.includes('historial') ? 'active' : ''}>Historial</Link>
            </>
          )}
        </div>
        <div className="nav-user">
          <span>{user?.name}</span>
          <button onClick={logout} className="btn-small">Salir</button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
