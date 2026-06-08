import { useState, useEffect } from 'react';
import api from '../api';

const STATUS_LABELS: Record<string, string> = {
  acepto: 'Aceptó', rechazo: 'Rechazó', no_contesta: 'No contesta',
  numero_invalido: 'Número inválido', ya_en_app: 'Ya está en la app',
  llamar_despues: 'Llamar después', sin_info: 'Sin información'
};

export default function SupervisorDashboard() {
  const [dash, setDash] = useState<any>(null);

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setDash(r.data)).catch(() => {});
  }, []);

  if (!dash) return <div>Cargando...</div>;

  return (
    <div>
      <h2>Dashboard General</h2>
      <div className="stats-grid">
        <div className="stat-card"><strong>{dash.totalClients}</strong>Clientes</div>
        <div className="stat-card"><strong>{dash.totalCalls}</strong>Llamadas totales</div>
        <div className="stat-card"><strong>{dash.clientsCalled}</strong>Clientes contactados</div>
        <div className="stat-card"><strong>{dash.callsToday}</strong>Llamadas hoy</div>
      </div>

      <h3>Rendimiento por operador</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Operador</th><th>Asignados</th><th>Llamados</th><th>Intentos</th><th>Aceptaron</th><th>Avance</th></tr></thead>
          <tbody>
            {dash.byOperator.map((op: any) => (
              <tr key={op.id}>
                <td>{op.name}</td>
                <td>{op.assigned}</td>
                <td>{op.called}</td>
                <td>{op.attempts}</td>
                <td>{op.acepto}</td>
                <td>{op.assigned > 0 ? Math.round(op.called / op.assigned * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Tipificación de llamadas</h3>
      <div className="tags">
        {Object.entries(dash.byStatus).map(([k, v]) => (
          <span key={k} className="tag">{STATUS_LABELS[k] || k}: {v as number}</span>
        ))}
      </div>
    </div>
  );
}
