import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await login(username, password);
      const role = JSON.parse(localStorage.getItem('user') || '{}').role;
      navigate(role === 'supervisor' ? '/supervisor' : '/operator');
    } catch {
      setErr('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Highfil CRM</h1>
        <h2>Seguimiento de Llamadas</h2>
        {err && <div className="error">{err}</div>}
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuario" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required />
        <button type="submit">Iniciar Sesión</button>
      </form>
    </div>
  );
}
