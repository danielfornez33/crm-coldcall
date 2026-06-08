import { useState, useEffect } from 'react';
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

export default function OperatorHistory() {
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    api.get('/calls').then(r => setCalls(r.data)).catch(() => {});
  }, []);

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
                <td>{STATUS_LABELS[c.status] || c.status}</td>
                <td>{c.notes || '-'}</td>
              </tr>
            ))}
            {calls.length === 0 && <tr><td colSpan={5}>Sin llamadas registradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
