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

const CARGO_OPTIONS = [
  { value: 'dueno', label: 'Dueño' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'gerente_encargado', label: 'Gerente Encargado' },
  { value: 'gerente_compra', label: 'Gerente de Compra' },
  { value: 'cuentas_por_pagar', label: 'Cuentas por Pagar' }
];

// Función auxiliar para obtener el último estado de un cliente
const getLastCallStatus = (calls: Call[]): string | null => {
  if (!calls || calls.length === 0) return null;
  const sorted = [...calls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return sorted[0].status;
};

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
  if (!notes) return null;

  const parsedNotes = parseCallNotes(notes);
  
  if (!parsedNotes) {
    // Si no es JSON válido, mostrar como texto plano
    return <div className="call-notes-text">{notes}</div>;
  }

  return (
    <div className="call-notes-container">
      {parsedNotes.social_media && (
        Object.values(parsedNotes.social_media).some(v => v) && (
          <div className="call-notes-section">
            <h5 className="call-notes-title">Redes Sociales</h5>
            <div className="call-notes-grid">
              {parsedNotes.social_media.instagram && (
                <div className="call-notes-item">
                  <span className="call-notes-label">Instagram:</span>
                  <span className="call-notes-value">{parsedNotes.social_media.instagram}</span>
                </div>
              )}
              {parsedNotes.social_media.tiktok && (
                <div className="call-notes-item">
                  <span className="call-notes-label">TikTok:</span>
                  <span className="call-notes-value">{parsedNotes.social_media.tiktok}</span>
                </div>
              )}
              {parsedNotes.social_media.facebook && (
                <div className="call-notes-item">
                  <span className="call-notes-label">Facebook:</span>
                  <span className="call-notes-value">{parsedNotes.social_media.facebook}</span>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {parsedNotes.contacts && parsedNotes.contacts.length > 0 && (
        <div className="call-notes-section">
          <h5 className="call-notes-title">Contactos</h5>
          {parsedNotes.contacts.map((contact, idx) => (
            <div key={idx} className="call-notes-contact">
              <div className="contact-info-line">
                <span className="contact-info-name">{contact.nombre} {contact.apellido}</span>
                {contact.cargo && <span className="contact-info-cargo">({contact.cargo})</span>}
              </div>
              {contact.telefono && (
                <div className="contact-info-detail">
                  <span className="contact-info-label">Tel:</span>
                  <span className="contact-info-value">{contact.telefono}</span>
                </div>
              )}
              {contact.fecha_cumpleanos && (
                <div className="contact-info-detail">
                  <span className="contact-info-label">Cumpleaños:</span>
                  <span className="contact-info-value">{contact.fecha_cumpleanos}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {parsedNotes.notas && (
        <div className="call-notes-section">
          <h5 className="call-notes-title">Notas Adicionales</h5>
          <div className="call-notes-text">{parsedNotes.notas}</div>
        </div>
      )}
    </div>
  );
}

interface Client {
  id: number; first_name: string; last_name: string; organization: string;
  phone: string; nickname: string; city: string;
}

interface Call { id: number; status: string; notes: string; created_at: string; operator_name: string; scheduled_at: string; }

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

// Componente: Inputs de Redes Sociales
function SocialMediaInputs({ socialMedia, setSocialMedia }: { 
  socialMedia: SocialMedia; 
  setSocialMedia: (s: SocialMedia) => void;
}) {
  const handleChange = (platform: keyof SocialMedia, value: string) => {
    setSocialMedia({ ...socialMedia, [platform]: value });
  };

  return (
    <div className="social-media-section">
      <h4 className="section-title">Redes Sociales</h4>
      <div className="social-input-group">
        <div className="form-field">
          <label>Instagram</label>
          <input 
            type="text" 
            placeholder="@usuario"
            value={socialMedia.instagram}
            onChange={(e) => handleChange('instagram', e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label>TikTok</label>
          <input 
            type="text" 
            placeholder="@usuario"
            value={socialMedia.tiktok}
            onChange={(e) => handleChange('tiktok', e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label>Facebook</label>
          <input 
            type="text" 
            placeholder="facebook.com/usuario"
            value={socialMedia.facebook}
            onChange={(e) => handleChange('facebook', e.target.value)}
            className="form-input"
          />
        </div>
      </div>
    </div>
  );
}

// Componente: Fila Individual de Contacto
function ContactRow({ 
  contact, 
  index, 
  onUpdate, 
  onRemove 
}: { 
  contact: Contact; 
  index: number; 
  onUpdate: (index: number, field: keyof Contact, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="contact-row">
      <div className="contact-row-line-1">
        <input
          type="text"
          placeholder="Nombre"
          value={contact.nombre}
          onChange={(e) => onUpdate(index, 'nombre', e.target.value)}
          className="contact-input"
        />
        <input
          type="text"
          placeholder="Apellido"
          value={contact.apellido}
          onChange={(e) => onUpdate(index, 'apellido', e.target.value)}
          className="contact-input"
        />
        <input
          type="text"
          placeholder="0424-1234567"
          value={contact.telefono}
          onChange={(e) => onUpdate(index, 'telefono', e.target.value)}
          className="contact-input phone-input"
        />
      </div>
      <div className="contact-row-line-2">
        <input
          type="date"
          value={contact.fecha_cumpleanos}
          onChange={(e) => onUpdate(index, 'fecha_cumpleanos', e.target.value)}
          className="contact-input"
        />
        <select
          value={contact.cargo}
          onChange={(e) => onUpdate(index, 'cargo', e.target.value)}
          className="contact-select"
        >
          <option value="">Seleccionar cargo</option>
          {CARGO_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => onRemove(index)}
          className="btn-remove-contact"
          title="Eliminar contacto"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Componente: Lista de Contactos
function ContactsList({ 
  contacts, 
  setContacts 
}: { 
  contacts: Contact[]; 
  setContacts: (c: Contact[]) => void;
}) {
  const handleUpdate = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleRemove = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setContacts([...contacts, {
      nombre: '',
      apellido: '',
      telefono: '',
      fecha_cumpleanos: '',
      cargo: ''
    }]);
  };

  return (
    <div className="contacts-section">
      <h4 className="section-title">Contactos</h4>
      <div className="contacts-list">
        {contacts.map((contact, index) => (
          <ContactRow
            key={index}
            contact={contact}
            index={index}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="btn-add-contact"
      >
        + Agregar Contacto
      </button>
    </div>
  );
}

export default function OperatorDashboard() {
  const { companyId } = useParams<{ companyId: string }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsMap, setCallsMap] = useState<Record<number, Call[]>>({});
  const [status, setStatus] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [reload, setReload] = useState(0);
  const [socialMedia, setSocialMedia] = useState<SocialMedia>({
    instagram: '',
    tiktok: '',
    facebook: ''
  });
  const [contacts, setContacts] = useState<Contact[]>([]);

  const triggerReload = () => setReload(x => x + 1);

   useEffect(() => {
    if (!companyId) return;
    api.get(`/companies/${companyId}/reports/dashboard`).catch(() => {});
    api.get(`/companies/${companyId}/calls/stats/mine`).then(r => setStats(r.data)).catch(() => {});
    api.get(`/companies/${companyId}/clients`, { params: { assigned: 'mine' } })
      .then(r => {
        setClients(r.data);
        // Cargar llamadas de todos los clientes
        r.data.forEach((client: Client) => {
          api.get(`/companies/${companyId}/calls`, { params: { client_id: client.id } })
            .then(callsRes => {
              setCallsMap(prev => ({ ...prev, [client.id]: callsRes.data }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, [companyId, reload]);

  useEffect(() => {
    if (selected && companyId) {
      api.get(`/companies/${companyId}/calls`, { params: { client_id: selected.id } }).then(r => setCalls(r.data)).catch(() => {});
    }
  }, [selected, companyId]);

  const serializeNotes = (): string => {
    const notesData: CallNotes = {
      social_media: socialMedia,
      contacts: contacts,
      notas: generalNotes
    };
    return JSON.stringify(notesData);
  };

  const registerCall = async () => {
    if (!selected || !status || !companyId) return;
    await api.post(`/companies/${companyId}/calls`, { 
      client_id: selected.id, 
      status, 
      notes: serializeNotes()
    });
    setStatus('');
    setGeneralNotes('');
    setSocialMedia({ instagram: '', tiktok: '', facebook: '' });
    setContacts([]);
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
            {filtered.map(c => {
              const lastStatus = getLastCallStatus(callsMap[c.id] || []);
              return (
                <div key={c.id} className={`client-card ${selected?.id === c.id ? 'selected' : ''}`}
                     onClick={() => setSelected(c)}>
                  <div className="client-card-content">
                    <div>
                      <div className="client-name">{c.first_name} {c.last_name}</div>
                      <div className="client-info">{c.organization || c.nickname}</div>
                      <div className="client-phone">{c.phone}</div>
                    </div>
                    {lastStatus && (
                      <div 
                        className="client-status-indicator" 
                        style={{ backgroundColor: STATUS_COLORS[lastStatus] }}
                        title={STATUS_LABELS[lastStatus]}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="empty">No hay clientes asignados</div>}
          </div>
        </div>

        <div className="call-panel">
          {selected ? (
            <>
              <h2>{selected.first_name} {selected.last_name}</h2>
              <p className="client-header-info">{selected.organization} | <span className="phone-display">{selected.phone}</span> {selected.city ? `| ${selected.city}` : ''}</p>

              <div className="call-form">
                <h3>Registrar llamada</h3>
                
                <SocialMediaInputs 
                  socialMedia={socialMedia} 
                  setSocialMedia={setSocialMedia}
                />
                
                <ContactsList 
                  contacts={contacts} 
                  setContacts={setContacts}
                />

                <div className="general-notes-section">
                  <h4 className="section-title">Notas Adicionales</h4>
                  <textarea 
                    value={generalNotes} 
                    onChange={e => setGeneralNotes(e.target.value)} 
                    placeholder="Notas..." 
                    rows={3}
                    className="form-textarea"
                  />
                </div>

                <div className="status-grid">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button key={key} className={`status-btn ${status === key ? 'active' : ''}`}
                            style={{ borderColor: STATUS_COLORS[key], backgroundColor: status === key ? STATUS_COLORS[key] : 'transparent', color: status === key ? '#fff' : STATUS_COLORS[key] }}
                            onClick={() => setStatus(key)}>
                      {label}
                    </button>
                  ))}
                </div>

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
                      {c.notes && <CallNotesDisplay notes={c.notes} />}
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