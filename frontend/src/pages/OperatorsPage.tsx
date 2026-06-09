import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface User { id: number; username: string; role: string; name: string; active: boolean; }
interface Client { id: number; first_name: string; last_name: string; phone: string; organization: string; }

export default function OperatorsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('operator');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'assign'>('manage');
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadAllClients();
  }, []);

  async function loadUsers() {
    try {
      if (!companyId) return;
      const r = await api.get(`/companies/${companyId}/import/operators`);
      setUsers(r.data || []);
    } catch {}
  }

  async function loadAllClients() {
    try {
      if (!companyId) return;
      const r = await api.get(`/companies/${companyId}/clients`);
      setAllClients(r.data || []);
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
      if (!companyId) return;
      const payload: Record<string, string> = {};
      if (editForm.name) payload.name = editForm.name;
      if (editForm.username) payload.username = editForm.username;
      if (editForm.password) payload.password = editForm.password;

      const r = await api.put(`/companies/${companyId}/import/operator/${id}`, payload);
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
      if (!companyId) return;
      if (user.active) {
        if (!confirm(`Desactivar a "${user.name}"?`)) return;
        await api.delete(`/companies/${companyId}/import/operator/${user.id}`);
      } else {
        await api.put(`/companies/${companyId}/import/operator/${user.id}`, { active: true });
      }
      await new Promise(r => setTimeout(r, 500));
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
      if (!companyId) return;
      await api.post(`/companies/${companyId}/import/operator`, {
        username: createUsername,
        password: createPassword,
        name: createName,
        role: createRole
      });
      setMsg(`Operador "${createName}" creado!`);
      setCreateName('');
      setCreateUsername('');
      setCreatePassword('');
      setCreateRole('operator');
      setCreating(false);
      await loadUsers();
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error');
    }
  }

  const toggleClientSelection = (clientId: number) => {
    const newSet = new Set(selectedClientIds);
    if (newSet.has(clientId)) {
      newSet.delete(clientId);
    } else {
      newSet.add(clientId);
    }
    setSelectedClientIds(newSet);
  };

  async function assignClientsToOperator() {
    if (!selectedOperatorId || !companyId) return;
    setAssignLoading(true);
    try {
      const clientIds = Array.from(selectedClientIds);
      const result = await api.post(`/companies/${companyId}/import/assign`, {
        client_ids: clientIds,
        operator_id: selectedOperatorId
      });

      setMsg(`${result.data.assigned} cliente(s) asignado(s) a ${users.find(u => u.id === selectedOperatorId)?.name}`);
      setSelectedClientIds(new Set());
      setSelectedOperatorId(null);
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error al asignar');
    }
    setAssignLoading(false);
  }

  const operators = users.filter(u => u.role === 'operator');

  return (
    <div>
      <h2>Gestionar Operadores</h2>

      {msg && <div className="msg" onClick={() => setMsg('')} style={{cursor:'pointer'}}>{msg}</div>}
      {err && <div className="error" onClick={() => setErr('')} style={{cursor:'pointer',marginBottom:12}}>{err}</div>}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid #ddd', display: 'flex', gap: 20 }}>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            padding: '10px 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'manage' ? 'bold' : 'normal',
            borderBottom: activeTab === 'manage' ? '2px solid #007bff' : 'none',
            color: activeTab === 'manage' ? '#007bff' : '#666'
          }}
        >
          Crear/Editar Operadores
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          style={{
            padding: '10px 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'assign' ? 'bold' : 'normal',
            borderBottom: activeTab === 'assign' ? '2px solid #007bff' : 'none',
            color: activeTab === 'assign' ? '#007bff' : '#666'
          }}
        >
          Asignar Clientes
        </button>
      </div>

      {/* TAB: Manage */}
      {activeTab === 'manage' && (
        <>
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
                <select
                  value={createRole}
                  onChange={e => setCreateRole(e.target.value)}
                >
                  <option value="operator">Operador</option>
                  <option value="supervisor">Supervisor</option>
                </select>
                <button type="submit" className="btn-primary">Crear</button>
                <button type="button" className="btn-edit" onClick={() => { setCreating(false); setErr(''); }}>Cancelar</button>
              </form>
            </div>
          )}
        </>
      )}

      {/* TAB: Assign */}
      {activeTab === 'assign' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          {/* Operadores */}
          <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8, height: 'fit-content' }}>
            <h3 style={{ marginTop: 0 }}>Operadores Activos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {operators.filter(o => o.active).map(op => (
                <button
                  key={op.id}
                  onClick={() => {
                    setSelectedOperatorId(op.id);
                    setSelectedClientIds(new Set());
                  }}
                  style={{
                    padding: 12,
                    border: selectedOperatorId === op.id ? '2px solid #007bff' : '1px solid #ddd',
                    background: selectedOperatorId === op.id ? '#e7f3ff' : 'white',
                    borderRadius: 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: selectedOperatorId === op.id ? 'bold' : 'normal'
                  }}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>

          {/* Clientes */}
          <div>
            {selectedOperatorId ? (
              <>
                <h3>Seleccionar Clientes para {operators.find(o => o.id === selectedOperatorId)?.name}</h3>
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: 8, 
                  padding: 15, 
                  maxHeight: 500, 
                  overflowY: 'auto',
                  marginBottom: 15
                }}>
                  {allClients.map(client => (
                    <div key={client.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10, 
                      padding: 10, 
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(client.id)}
                        onChange={() => toggleClientSelection(client.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label style={{ flex: 1, cursor: 'pointer' }}>
                        <strong>{client.first_name} {client.last_name}</strong>
                        <br />
                        <small style={{ color: '#666' }}>
                          {client.organization} - {client.phone}
                        </small>
                      </label>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => {
                      setSelectedOperatorId(null);
                      setSelectedClientIds(new Set());
                    }}
                    className="btn-edit"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={assignClientsToOperator}
                    className="btn-primary"
                    disabled={assignLoading || selectedClientIds.size === 0}
                  >
                    {assignLoading ? 'Asignando...' : `Asignar ${selectedClientIds.size} cliente(s)`}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ 
                background: '#f0f0f0', 
                padding: 40, 
                borderRadius: 8, 
                textAlign: 'center', 
                color: '#999' 
              }}>
                Selecciona un operador a la izquierda
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}