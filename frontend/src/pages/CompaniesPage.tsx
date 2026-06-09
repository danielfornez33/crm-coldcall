import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Company {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '' });

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

  if (user?.role !== 'super_admin') {
    return <div className="p-container"><h2>Acceso solo para Super Admin</h2></div>;
  }

  return (
    <div className="p-container">
      <h1>Gestión de Empresas</h1>

      <form onSubmit={handleCreate} className="form-section">
        <h3>Crear Nueva Empresa</h3>
        <div className="form-row">
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Slug (opcional)"
            value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value })}
          />
          <button type="submit" className="btn">Crear</button>
        </div>
      </form>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : companies.length === 0 ? (
        <p>No hay empresas.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Activa</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>{c.active ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}