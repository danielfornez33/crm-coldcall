import { useState } from 'react';
import api from '../api';

export default function OperatorsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/import/operator', { username, password, name });
      setMsg(`Operador "${name}" creado!`);
      setUsername(''); setPassword(''); setName('');
    } catch (err: any) {
      setMsg(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div>
      <h2>Gestionar Operadores</h2>
      {msg && <div className="msg">{msg}</div>}
      <form onSubmit={create} className="form-inline">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" required />
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuario" required />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" type="password" required />
        <button type="submit" className="btn-primary">Crear operador</button>
      </form>
    </div>
  );
}
