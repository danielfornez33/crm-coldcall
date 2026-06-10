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

interface SocialMedia {
  instagram: string;
  tiktok: string;
  facebook: string;
}

interface Contact {
  nombre: string;
  apellido: string;
  telefono: string;
  fecha_cumpleanos: string;
  cargo: string;
}

interface CallNotes {
  social_media: SocialMedia;
  contacts: Contact[];
  notas: string;
}

// Función para parsear las notas JSON
const parseCallNotes = (notesStr: string): CallNotes | null => {
  try {
    if (!notesStr) return null;
    return JSON.parse(notesStr);
  } catch (e) {
    return null;
  }
};

// Componente para renderizar las notas parseadas
function CallNotesDisplay({ notes }: { notes: string | undefined }) {
  if (!notes) return <span>-</span>;

  const parsedNotes = parseCallNotes(notes);
  
  if (!parsedNotes) {
    // Si no es JSON válido, mostrar como texto plano
    return <span>{notes}</span>;
  }

  // Contar elementos para mostrar resumen
  const socialCount = Object.values(parsedNotes.social_media || {}).filter(v => v).length;
  const contactCount = (parsedNotes.contacts || []).length;
  const hasNotes = !!parsedNotes.notas;

  return (
    <div className="notes-summary">
      {socialCount > 0 && <span className="summary-badge">📱 {socialCount}</span>}
      {contactCount > 0 && <span className="summary-badge">👥 {contactCount}</span>}
      {hasNotes && <span className="summary-badge">📝</span>}
    </div>
  );
}

export default function OperatorHistory() {
  const [calls, setCalls] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { activeCompanyId } = useAuth();

  useEffect(() => {
    if (!activeCompanyId) return;
    api.get(`/companies/${activeCompanyId}/calls`).then(r => setCalls(r.data)).catch(() => {});
  }, [activeCompanyId]);

  const handleRowClick = (callId: number) => {
    setExpandedId(expandedId === callId ? null : callId);
  };

  const renderNotesDetail = (notes: string | undefined) => {
    if (!notes) return null;

    const parsedNotes = parseCallNotes(notes);
    
    if (!parsedNotes) {
      return (
        <div className="notes-detail-section">
          <p className="notes-detail-text">{notes}</p>
        </div>
      );
    }

    return (
      <div className="notes-detail-container">
        {parsedNotes.social_media && 
          Object.values(parsedNotes.social_media).some(v => v) && (
          <div className="notes-detail-section">
            <h5 className="notes-detail-title">📱 Redes Sociales</h5>
            <div className="notes-detail-grid">
              {parsedNotes.social_media.instagram && (
                <div className="notes-detail-item">
                  <span className="notes-detail-label">Instagram:</span>
                  <span className="notes-detail-value">{parsedNotes.social_media.instagram}</span>
                </div>
              )}
              {parsedNotes.social_media.tiktok && (
                <div className="notes-detail-item">
                  <span className="notes-detail-label">TikTok:</span>
                  <span className="notes-detail-value">{parsedNotes.social_media.tiktok}</span>
                </div>
              )}
              {parsedNotes.social_media.facebook && (
                <div className="notes-detail-item">
                  <span className="notes-detail-label">Facebook:</span>
                  <span className="notes-detail-value">{parsedNotes.social_media.facebook}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {parsedNotes.contacts && parsedNotes.contacts.length > 0 && (
          <div className="notes-detail-section">
            <h5 className="notes-detail-title">👥 Contactos ({parsedNotes.contacts.length})</h5>
            {parsedNotes.contacts.map((contact, idx) => (
              <div key={idx} className="notes-detail-contact">
                <div className="contact-header">
                  <span className="contact-name">{contact.nombre} {contact.apellido}</span>
                  {contact.cargo && <span className="contact-role">{contact.cargo}</span>}
                </div>
                {contact.telefono && <div className="contact-row"><span className="contact-label">Tel:</span> {contact.telefono}</div>}
                {contact.fecha_cumpleanos && <div className="contact-row"><span className="contact-label">Cumpleaños:</span> {contact.fecha_cumpleanos}</div>}
              </div>
            ))}
          </div>
        )}

        {parsedNotes.notas && (
          <div className="notes-detail-section">
            <h5 className="notes-detail-title">📝 Notas Adicionales</h5>
            <p className="notes-detail-text">{parsedNotes.notas}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2>Historial de llamadas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
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
              <>
                <tr 
                  key={c.id} 
                  onClick={() => handleRowClick(c.id)}
                  className={`call-row ${expandedId === c.id ? 'expanded' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="expand-icon">
                    {c.notes && <span className={`arrow ${expandedId === c.id ? 'open' : ''}`}>▶</span>}
                  </td>
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
                  <td>
                    <CallNotesDisplay notes={c.notes} />
                  </td>
                </tr>
                {expandedId === c.id && c.notes && (
                  <tr className="notes-detail-row">
                    <td colSpan={7}>
                      {renderNotesDetail(c.notes)}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {calls.length === 0 && <tr><td colSpan={7} style={{textAlign: 'center', color: '#999'}}>Sin llamadas registradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}