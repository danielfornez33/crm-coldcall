import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import OperatorDashboard from './pages/OperatorDashboard';
import OperatorHistory from './pages/OperatorHistory';
import SupervisorDashboard from './pages/SupervisorDashboard';
import SupervisorClients from './pages/SupervisorClients';
import SupervisorCallHistory from './pages/SupervisorCallHistory';
import ImportPage from './pages/ImportPage';
import OperatorsPage from './pages/OperatorsPage';
import CompaniesPage from './pages/CompaniesPage';

function Home() {
  const { user, companies, loading } = useAuth();
  
  if (loading) return <div className="loading">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'super_admin') {
    if (companies.length === 0) {
      return <Navigate to="/companies" />;
    }
    return <Navigate to="/companies" />;
  }
  
  if (companies.length === 0) return <div className="loading">Cargando empresas...</div>;

  const companyId = companies[0].id;
  return <Navigate to={`/companies/${companyId}/${user.role === 'supervisor' ? 'supervisor' : 'operator'}`} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/companies/:companyId/operator" element={<ProtectedRoute role="operator"><Layout><OperatorDashboard /></Layout></ProtectedRoute>} />
          <Route path="/companies" element={<ProtectedRoute role="super_admin"><Layout><CompaniesPage /></Layout></ProtectedRoute>} />
          <Route path="/companies/:companyId/operator/historial" element={<ProtectedRoute role="operator"><Layout><OperatorHistory /></Layout></ProtectedRoute>} />
          <Route path="/companies/:companyId/supervisor" element={<ProtectedRoute role="supervisor"><Layout><SupervisorDashboard /></Layout></ProtectedRoute>} />
           <Route path="/companies/:companyId/supervisor/clientes" element={<ProtectedRoute role="supervisor"><Layout><SupervisorClients /></Layout></ProtectedRoute>} />
           <Route path="/companies/:companyId/supervisor/importar" element={<ProtectedRoute role="supervisor"><Layout><ImportPage /></Layout></ProtectedRoute>} />
           <Route path="/companies/:companyId/supervisor/operadores" element={<ProtectedRoute role="supervisor"><Layout><OperatorsPage /></Layout></ProtectedRoute>} />
           <Route path="/companies/:companyId/supervisor/historial" element={<ProtectedRoute role="supervisor"><Layout><SupervisorCallHistory /></Layout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;