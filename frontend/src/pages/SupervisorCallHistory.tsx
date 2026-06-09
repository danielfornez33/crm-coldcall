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

export default function SupervisorCallHistory() {
  const [calls, setCalls] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { activeCompanyId } = useAuth();

  useEffect(() => {
    if (!activeCompanyId) return;
    loadOperators();
    loadAllCalls();
  }, [activeCompanyId]);

  const loadOperators = async () => {
    try {
      const { data } = await api.get(`/companies/${activeCompanyId}/import/operators`);
      setOperators(data || []);
    } catch (err) {
      console.error('Error loading operators:', err);
    }
  };

  const loadAllCalls = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/companies/${activeCompanyId}/calls`);
      setCalls(data || []);
    } catch (err) {
      console.error('Error loading calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = selectedOperatorId
    ? calls.filter(c => c.operator_id === selectedOperatorId)
    : calls;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'acepto':
        return { bg: '#d4edda', color: '#155724' };
      case 'rechazo':
        return { bg: '#f8d7da', color: '#721c24' };
      case 'no_contesta':
        return { bg: '#fff3cd', color: '#856404' };
      case 'numero_invalido':
        return { bg: '#d1ecf1', color: '#0c5460' };
      default:
        return { bg: '#e2e3e5', color: '#383d41' };
    }
  };

  return (
    <div>
      <h2>Historial de Llamadas</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Filtro de operadores */}
        <div style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Filtrar por Operador</h3>
          <button
            onClick={() => setSelectedOperatorId(null)}
            style={{
              width: '100%',
              padding: 10,
              marginBottom: 10,
              border: !selectedOperatorId ? '2px solid #007bff' : '1px solid #ddd',
              background: !selectedOperatorId ? '#e7f3ff' : 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: !selectedOperatorId ? 'bold' : 'normal',
              textAlign: 'left'
            }}
          >
            <strong>Todos</strong>
          </button>
          {operators.map(op => (
            <button
              key={op.id}
              onClick={() => setSelectedOperatorId(op.id)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 10,
                border: selectedOperatorId === op.id ? '2px solid #007bff' : '1px solid #ddd',
                background: selectedOperatorId === op.id ? '#e7f3ff' : 'white',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: selectedOperatorId === op.id ? 'bold' : 'normal',
                textAlign: 'left',
                opacity: op.active ? 1 : 0.6
              }}
              disabled={!op.active}
            >
              {op.name}
            </button>
          ))}
        </div>

        {/* Tabla de llamadas */}
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Operador</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                      Cargando...
                    </td>
                  </tr>
                ) : filteredCalls.length > 0 ? (
                  filteredCalls.map(c => {
                    const statusColor = getStatusColor(c.status);
                    return (
                      <tr key={c.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {new Date(c.created_at).toLocaleString('es-MX', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td>{c.operator_name || 'N/A'}</td>
                        <td>
                          <strong>{c.first_name} {c.last_name}</strong>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{c.phone}</td>
                        <td>{c.organization || '-'}</td>
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: statusColor.bg,
                            color: statusColor.color,
                            fontWeight: 'bold'
                          }}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                      {selectedOperatorId
                        ? 'Este operador no tiene llamadas registradas'
                        : 'Sin llamadas registradas'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredCalls.length > 0 && (
            <div style={{ marginTop: 15, textAlign: 'right', fontSize: 14, color: '#666' }}>
              <strong>Total:</strong> {filteredCalls.length} llamadas
              {selectedOperatorId && (
                <>
                  <br />
                  <strong>Aceptadas:</strong> {filteredCalls.filter(c => c.status === 'acepto').length}
                  {' | '}
                  <strong>Rechazadas:</strong> {filteredCalls.filter(c => c.status === 'rechazo').length}
                  {' | '}
                  <strong>Sin contestar:</strong> {filteredCalls.filter(c => c.status === 'no_contesta').length}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}