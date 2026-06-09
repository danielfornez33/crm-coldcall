import { useState, useEffect } from 'react';
import api from '../api';

export default function SupervisorClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [operators, setOperators] = useState<any[]>([]);
  const [selectedOp, setSelectedOp] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get('/import/operators').then(r => setOperators(r.data)).catch(() => {});
    api.get('/clients', { params: { search } }).then(r => setClients(r.data)).catch(() => {});
  }, [search]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const assignAll = async () => {
    if (!selectedOp || selectedIds.size === 0) return;
    await api.post('/import/assign', { client_ids: Array.from(selectedIds), operator_id: parseInt(selectedOp) });
    setSelectedIds(new Set());
    alert('Asignados!');
  };

  return (
    <div>
      <h2>Clientes {clients.length}</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="search-input" />

      {selectedIds.size > 0 && (
        <div className="assign-bar">
          <span>{selectedIds.size} seleccionados</span>
          <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)}>
            <option value="">Asignar a...</option>
            {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
          </select>
          <button onClick={assignAll} disabled={!selectedOp} className="btn-primary">Asignar</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={e => {
                if (e.target.checked) setSelectedIds(new Set(clients.map(c => c.id)));
                else setSelectedIds(new Set());
              }} checked={selectedIds.size === clients.length && clients.length > 0} /></th>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.organization || '-'}</td>
                <td>{c.phone}</td>
                <td>{c.city || '-'}</td>
                <td>{c.source || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
