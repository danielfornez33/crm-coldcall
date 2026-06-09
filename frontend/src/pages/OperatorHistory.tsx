import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS: Record<string, string> = {
  acepto: 'Aceptó',
  rechazo: 'Rechazó',
  no_contesta: 'No contesta',
  numero_invalido: 'Número inválido',
  ya_en_app: 'Ya está en la app',
  llamar_despues: 'Llamar después',
  sin_info: 'Sin información',
  pendiente: 'Pendiente'
};

export default function OperatorHistory() {
  const [calls, setCalls] = useState<any[]>([]);
  const { activeCompanyId } = useAuth();

  useEffect(() => {
    if (!activeCompanyId) return;
    api.get(`/companies/${activeCompanyId}/calls`).then(r => setCalls(r.data)).catch(() => {});
  }, [activeCompanyId]);

  return (
    <div>
      <h2>Historial de llamadas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Empresa</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(c => (
              <tr key={c.id}>
                <td>{new Date(c.created_at).toLocaleString('es-MX')}</td>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.phone}</td>
                <td>{c.organization || '-'}</td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: 
                      c.status === 'acepto' ? '#d4edda' :
                      c.status === 'rechazo' ? '#f8d7da' :
                      c.status === 'no_contesta' ? '#fff3cd' :
                      c.status === 'numero_invalido' ? '#d1ecf1' :
                      '#e2e3e5',
                    color: 
                      c.status === 'acepto' ? '#155724' :
                      c.status === 'rechazo' ? '#721c24' :
                      c.status === 'no_contesta' ? '#856404' :
                      c.status === 'numero_invalido' ? '#0c5460' :
                      '#383d41'
                  }}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </td>
                <td>{c.notes || '-'}</td>
              </tr>
            ))}
            {calls.length === 0 && <tr><td colSpan={6} style={{textAlign: 'center', color: '#999'}}>Sin llamadas registradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}