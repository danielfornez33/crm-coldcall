import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

const STATUS_LABELS: Record<string, string> = {
  acepto: 'Aceptó',
  rechazo: 'Rechazó',
  no_contesta: 'No contesta',
  numero_invalido: 'Número inválido',
  ya_en_app: 'Ya está en la app',
  llamar_despues: 'Llamar después',
  sin_info: 'Sin información'
};

const STATUS_COLORS: Record<string, string> = {
  acepto: '#27ae60',
  rechazo: '#e74c3c',
  no_contesta: '#f39c12',
  numero_invalido: '#95a5a6',
  ya_en_app: '#2980b9',
  llamar_despues: '#8e44ad',
  sin_info: '#7f8c8d'
};

interface Client {
  id: number; first_name: string; last_name: string; organization: string;
  phone: string; nickname: string; city: string;
}

interface Call { id: number; status: string; notes: string; created_at: string; operator_name: string; scheduled_at: string; }

export default function OperatorDashboard() {
  const { companyId } = useParams<{ companyId: string }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [reload, setReload] = useState(0);

  const triggerReload = () => setReload(x => x + 1);

  useEffect(() => {
    if (!companyId) return;
    api.get(`/companies/${companyId}/reports/dashboard`).catch(() => {});
    api.get(`/companies/${companyId}/calls/stats/mine`).then(r => setStats(r.data)).catch(() => {});
    api.get(`/companies/${companyId}/clients`, { params: { assigned: 'mine' } })
      .then(r => setClients(r.data))
      .catch(() => {});
  }, [companyId, reload]);

  useEffect(() => {
    if (selected && companyId) {
      api.get(`/companies/${companyId}/calls`, { params: { client_id: selected.id } }).then(r => setCalls(r.data)).catch(() => {});
    }
  }, [selected, companyId]);

  const registerCall = async () => {
    if (!selected || !status || !companyId) return;
    await api.post(`/companies/${companyId}/calls`, { client_id: selected.id, status, notes });
    setStatus('');
    setNotes('');
    triggerReload();
  };

  const filtered = clients.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.first_name?.toLowerCase().includes(s) ||
      c.last_name?.toLowerCase().includes(s) ||
      c.organization?.toLowerCase().includes(s) ||
      c.phone?.includes(s));
  });

  return (
    <div className="operator-dashboard">
      <div className="stats-bar">
        <div className="stat"><strong>{stats?.assigned || 0}</strong> Asignados</div>
        <div className="stat"><strong>{stats?.total_called || 0}</strong> Llamados</div>
        <div className="stat"><strong>{stats?.total_attempts || 0}</strong> Intentos</div>
        <div className="stat" style={{color: '#27ae60'}}><strong>{stats?.acepto || 0}</strong> Aceptaron</div>
        <div className="stat" style={{color: '#e74c3c'}}><strong>{stats?.rechazo || 0}</strong> Rechazaron</div>
      </div>

      <div className="operator-content">
        <div className="client-list-panel">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="search-input" />
          <div className="client-scroll">
            {filtered.map(c => (
              <div key={c.id} className={`client-card ${selected?.id === c.id ? 'selected' : ''}`}
                   onClick={() => setSelected(c)}>
                <div className="client-name">{c.first_name} {c.last_name}</div>
                <div className="client-info">{c.organization || c.nickname}</div>
                <div className="client-phone">{c.phone}</div>
              </div>
            ))}
            {filtered.length === 0 && <div className="empty">No hay clientes asignados</div>}
          </div>
        </div>

        <div className="call-panel">
          {selected ? (
            <>
              <h2>{selected.first_name} {selected.last_name}</h2>
              <p>{selected.organization} | {selected.phone} {selected.city ? `| ${selected.city}` : ''}</p>

              <div className="call-form">
                <h3>Registrar llamada</h3>
                <div className="status-grid">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button key={key} className={`status-btn ${status === key ? 'active' : ''}`}
                            style={{ borderColor: STATUS_COLORS[key], backgroundColor: status === key ? STATUS_COLORS[key] : 'transparent', color: status === key ? '#fff' : STATUS_COLORS[key] }}
                            onClick={() => setStatus(key)}>
                      {label}
                    </button>
                  ))}
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas..." rows={3} />
                <button onClick={registerCall} disabled={!status} className="btn-primary">Guardar llamada</button>
              </div>

              {calls.length > 0 && (
                <div className="call-history">
                  <h3>Historial de llamadas</h3>
                  {calls.map(c => (
                    <div key={c.id} className="call-entry">
                      <span className="call-status" style={{ color: STATUS_COLORS[c.status] }}>
                        {STATUS_LABELS[c.status]}
                      </span>
                      <span className="call-date">{new Date(c.created_at).toLocaleString('es-MX')}</span>
                      {c.notes && <div className="call-notes">{c.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-panel">Selecciona un cliente para comenzar</div>
          )}
        </div>
      </div>
    </div>
  );
}