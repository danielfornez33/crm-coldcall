import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isSupervisor = user?.role === 'supervisor';

  return (
    <div className="app-layout">
      <nav className="nav">
        <div className="nav-brand">Highfil CRM</div>
        <div className="nav-links">
          {isSupervisor && (
            <>
              <Link to="/supervisor" className={loc.pathname === '/supervisor' ? 'active' : ''}>Dashboard</Link>
              <Link to="/supervisor/clientes" className={loc.pathname.includes('clientes') ? 'active' : ''}>Clientes</Link>
              <Link to="/supervisor/importar" className={loc.pathname === '/supervisor/importar' ? 'active' : ''}>Importar</Link>
              <Link to="/supervisor/operadores" className={loc.pathname === '/supervisor/operadores' ? 'active' : ''}>Operadores</Link>
            </>
          )}
          {!isSupervisor && (
            <>
              <Link to="/operator" className={loc.pathname === '/operator' ? 'active' : ''}>Mis llamadas</Link>
              <Link to="/operator/historial" className={loc.pathname.includes('historial') ? 'active' : ''}>Historial</Link>
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
