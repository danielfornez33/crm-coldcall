import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function ImportPage() {
  const [csvResult, setCsvResult] = useState<any>(null);
  const [vcfResult, setVcfResult] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [vcfFile, setVcfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const { activeCompanyId } = useAuth();

  const importCSV = async () => {
    if (!csvFile || !activeCompanyId) return;
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', csvFile);
    try {
      const r = await api.post(`/companies/${activeCompanyId}/import/csv`, fd);
      setCsvResult(r.data);
      setMsg(`CSV importado: ${r.data.imported} clientes nuevos, ${r.data.skipped} omitidos`);
    } catch (e: any) {
      setMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  const importVCF = async () => {
    if (!vcfFile || !activeCompanyId) return;
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', vcfFile);
    try {
      const r = await api.post(`/companies/${activeCompanyId}/import/vcf`, fd);
      setVcfResult(r.data);
      setMsg(`VCF importado: ${r.data.imported} contactos nuevos, ${r.data.skipped} omitidos`);
    } catch (e: any) {
      setMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>Importar contactos</h2>

      {msg && <div className="msg">{msg}</div>}

      <div className="import-grid">
        <div className="import-card">
          <h3>CSV (Google Contacts)</h3>
          <p>Sube tu archivo CSV exportado de Google Contacts</p>
          <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
          <button onClick={importCSV} disabled={!csvFile || loading || !activeCompanyId} className="btn-primary">Importar CSV</button>
          {csvResult && <div className="result">Importados: {csvResult.imported} | Omitidos: {csvResult.skipped}</div>}
        </div>

        <div className="import-card">
          <h3>VCF (vCard)</h3>
          <p>Sube tu archivo VCF de contactos</p>
          <input type="file" accept=".vcf,.vcard" onChange={e => setVcfFile(e.target.files?.[0] || null)} />
          <button onClick={importVCF} disabled={!vcfFile || loading || !activeCompanyId} className="btn-primary">Importar VCF</button>
          {vcfResult && <div className="result">Importados: {vcfResult.imported} | Omitidos: {vcfResult.skipped}</div>}
        </div>
      </div>
    </div>
  );
}