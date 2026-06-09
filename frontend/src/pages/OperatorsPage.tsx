import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface User { id: number; username: string; role: string; name: string; active: boolean; }

export default function OperatorsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const r = await api.get('/auth/users');
      setUsers(r.data);
    } catch {}
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({ name: user.name, username: user.username, password: '' });
    setErr('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: '', username: '', password: '' });
    setErr('');
  }

  async function saveEdit(id: number) {
    setErr('');
    try {
      const payload: Record<string, string> = {};
      if (editForm.name) payload.name = editForm.name;
      if (editForm.username) payload.username = editForm.username;
      if (editForm.password) payload.password = editForm.password;

      const r = await api.put(`/import/operator/${id}`, payload);
      setUsers(users.map(u => u.id === id ? { ...u, ...r.data } : u));
      setEditingId(null);
      setEditForm({ name: '', username: '', password: '' });
      setMsg('Operador actualizado');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error al actualizar');
    }
  }

  async function toggleActive(user: User) {
    try {
      if (user.active) {
        if (!confirm(`Desactivar a "${user.name}"?`)) return;
        await api.delete(`/import/operator/${user.id}`);
      } else {
        await api.put(`/import/operator/${user.id}`, { active: true });
      }
      await loadUsers();
      setMsg(user.active ? 'Operador desactivado' : 'Operador activado');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/import/operator', {
        username: createUsername,
        password: createPassword,
        name: createName
      });
      setMsg(`Operador "${createName}" creado!`);
      setCreateName('');
      setCreateUsername('');
      setCreatePassword('');
      setCreating(false);
      await loadUsers();
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error');
    }
  }

  const operators = users.filter(u => u.role === 'operator');

  return (
    <div>
      <h2>Gestionar Operadores</h2>

      {msg && <div className="msg" onClick={() => setMsg('')} style={{cursor:'pointer'}}>{msg}</div>}
      {err && <div className="error" onClick={() => setErr('')} style={{cursor:'pointer',marginBottom:12}}>{err}</div>}

      {operators.length > 0 && (
        <div className="table-wrap" style={{marginBottom:24}}>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {operators.map(op => {
                const isEditing = editingId === op.id;
                const isSelf = op.id === currentUser?.id;

                if (isEditing) {
                  return (
                    <tr key={op.id} className="edit-row">
                      <td>
                        <input
                          className="edit-input"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Nombre"
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          className="edit-input"
                          value={editForm.username}
                          onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                          placeholder="Usuario"
                        />
                      </td>
                      <td>
                        <input
                          className="edit-input"
                          type="password"
                          value={editForm.password}
                          onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                          placeholder="Nueva contrasena (opcional)"
                        />
                      </td>
                      <td>
                        <div className="edit-actions">
                          <button className="btn-primary btn-sm" onClick={() => saveEdit(op.id)}>Guardar</button>
                          <button className="btn-edit" onClick={cancelEdit}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={op.id} style={{opacity: op.active ? 1 : 0.5}}>
                    <td style={{color: op.active ? 'inherit' : '#999'}}>{op.name}</td>
                    <td style={{color: op.active ? 'inherit' : '#999'}}>{op.username}</td>
                    <td>
                      {op.active
                        ? <span className="active-tag">Activo</span>
                        : <span className="inactive-tag">Inactivo</span>
                      }
                    </td>
                    <td>
                      <div className="btn-actions">
                        <button className="btn-edit" onClick={() => startEdit(op)}>Editar</button>
                        {op.active && !isSelf && (
                          <button className="btn-danger" onClick={() => toggleActive(op)}>Desactivar</button>
                        )}
                        {!op.active && (
                          <button className="btn-activate" onClick={() => toggleActive(op)}>Activar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {operators.length === 0 && !creating && (
        <div className="empty-section" style={{marginBottom:24}}>No hay operadores registrados</div>
      )}

      {!creating ? (
        <div style={{display:'flex', justifyContent:'flex-end'}}>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo operador</button>
        </div>
      ) : (
        <div className="form-create" style={{background:'var(--white)', padding:20, borderRadius:'var(--radius)', boxShadow:'var(--shadow)'}}>
          <h3 style={{marginTop:0, marginBottom:12}}>Nuevo operador</h3>
          <form onSubmit={handleCreate} className="form-inline" style={{boxShadow:'none', padding:0, background:'transparent'}}>
            <input
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Nombre completo"
              required
            />
            <input
              value={createUsername}
              onChange={e => setCreateUsername(e.target.value)}
              placeholder="Usuario"
              required
            />
            <input
              value={createPassword}
              onChange={e => setCreatePassword(e.target.value)}
              placeholder="Contrasena"
              type="password"
              required
            />
            <button type="submit" className="btn-primary">Crear</button>
            <button type="button" className="btn-edit" onClick={() => { setCreating(false); setErr(''); }}>Cancelar</button>
          </form>
        </div>
      )}
    </div>
  );
}