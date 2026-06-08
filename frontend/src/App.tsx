import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import OperatorDashboard from './pages/OperatorDashboard';
import OperatorHistory from './pages/OperatorHistory';
import SupervisorDashboard from './pages/SupervisorDashboard';
import SupervisorClients from './pages/SupervisorClients';
import ImportPage from './pages/ImportPage';
import OperatorsPage from './pages/OperatorsPage';

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={user.role === 'supervisor' ? '/supervisor' : '/operator'} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/operator" element={<ProtectedRoute role="operator"><Layout><OperatorDashboard /></Layout></ProtectedRoute>} />
          <Route path="/operator/historial" element={<ProtectedRoute role="operator"><Layout><OperatorHistory /></Layout></ProtectedRoute>} />
          <Route path="/supervisor" element={<ProtectedRoute role="supervisor"><Layout><SupervisorDashboard /></Layout></ProtectedRoute>} />
          <Route path="/supervisor/clientes" element={<ProtectedRoute role="supervisor"><Layout><SupervisorClients /></Layout></ProtectedRoute>} />
          <Route path="/supervisor/importar" element={<ProtectedRoute role="supervisor"><Layout><ImportPage /></Layout></ProtectedRoute>} />
          <Route path="/supervisor/operadores" element={<ProtectedRoute role="supervisor"><Layout><OperatorsPage /></Layout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
