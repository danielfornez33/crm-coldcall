import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Company {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

interface User {
  id: number;
  username: string;
  name: string;
  role?: string;
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [userForm, setUserForm] = useState({ username: '', password: '', name: '', role: 'supervisor' });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const res = await api.get('/auth/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    try {
      await api.post('/auth/companies', { name: form.name, slug: form.slug || undefined });
      setForm({ name: '', slug: '' });
      loadCompanies();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error creating company');
    }
  }

  async function openUserModal(company: Company) {
    setSelectedCompany(company);
    setShowUserModal(true);
    setLoadingUsers(true);
    try {
      const res = await api.get(`/companies/${company.id}/import/operators`);
      setCompanyUsers(res.data || []);
    } catch {
      setCompanyUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

   async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    if (!selectedCompany || !userForm.username || !userForm.password || !userForm.name || !userForm.role) return;
    
    try {
      await api.post(`/companies/${selectedCompany.id}/import/operator`, {
        username: userForm.username,
        password: userForm.password,
        name: userForm.name,
        role: userForm.role
      });
      
      setUserSuccess(`Usuario "${userForm.username}" creado correctamente`);
      setUserForm({ username: '', password: '', name: '', role: 'supervisor' });
      
      // Esperar un poco y recargar usuarios
      setTimeout(async () => {
        const res = await api.get(`/companies/${selectedCompany.id}/import/operators`);
        setCompanyUsers(res.data || []);
        setUserSuccess('');
      }, 500);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Error al crear usuario';
      setUserError(errorMsg);
    }
  }

  if (user?.role !== 'super_admin') {
    return <div className="p-container"><h2>Acceso solo para Super Admin</h2></div>;
  }

  return (
    <div className="companies-page">
      <div className="p-container">
        <div className="page-header">
          <h1>Gestión de Empresas</h1>
          <p>Crea y administra empresas y usuarios</p>
        </div>

        <form onSubmit={handleCreate} className="form-section card">
          <h2>Crear Nueva Empresa</h2>
          <div className="form-group">
            <label>Nombre de la Empresa</label>
            <input
              type="text"
              placeholder="Ej: Mi Empresa"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Slug (opcional)</label>
            <input
              type="text"
              placeholder="Ej: mi-empresa"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary">Crear Empresa</button>
        </form>

        {loading ? (
          <div className="loading">Cargando empresas...</div>
        ) : companies.length === 0 ? (
          <div className="card empty-state">
            <p>No hay empresas creadas aún</p>
          </div>
        ) : (
          <div className="companies-grid">
            {companies.map(c => (
              <div key={c.id} className="company-card">
                <div className="company-header">
                  <h3>{c.name}</h3>
                  <span className={`badge ${c.active ? 'badge-active' : 'badge-inactive'}`}>
                    {c.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="company-body">
                  <p><strong>Slug:</strong> {c.slug}</p>
                </div>
                <div className="company-footer">
                  <button 
                    onClick={() => openUserModal(c)}
                    className="btn btn-secondary"
                  >
                    Gestionar Usuarios
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUserModal && selectedCompany && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Usuarios - {selectedCompany.name}</h2>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleCreateUser} className="user-form">
                <h3>Crear Nuevo Usuario</h3>
                {userError && <div className="error-message">{userError}</div>}
                {userSuccess && <div className="success-message">{userSuccess}</div>}
                
                <div className="form-group">
                  <label>Usuario</label>
                  <input
                    type="text"
                    placeholder="usuario123"
                    value={userForm.username}
                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                   <label>Nombre Completo</label>
                   <input
                     type="text"
                     placeholder="Juan Pérez"
                     value={userForm.name}
                     onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                     required
                   />
                 </div>

                 <div className="form-group">
                   <label>Rol</label>
                   <select
                     value={userForm.role}
                     onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                     required
                   >
                     <option value="supervisor">Supervisor</option>
                     <option value="operator">Operador</option>
                   </select>
                 </div>

                 <button type="submit" className="btn btn-primary">Crear Usuario</button>
              </form>

              <div className="users-list">
                <h3>Usuarios en esta empresa</h3>
                {loadingUsers ? (
                  <p>Cargando...</p>
                ) : companyUsers.length === 0 ? (
                  <p className="empty-text">Sin usuarios aún</p>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Nombre</th>
                        <th>Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.username}</td>
                          <td>{u.name}</td>
                          <td><span className="role-badge">{u.role}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}