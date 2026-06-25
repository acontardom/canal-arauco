import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../assets/Logo_ExMaq.jpg';

export default function Entrada() {
  const [nombre, setNombre] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState('');
  const [editando, setEditando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const n = localStorage.getItem('nombreTerreno');
    if (n) setNombreGuardado(n);
    else setEditando(true);
  }, []);

  function guardarNombre() {
    if (!nombre.trim()) return;
    localStorage.setItem('nombreTerreno', nombre.trim());
    setNombreGuardado(nombre.trim());
    setEditando(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2rem 1.5rem' }}>
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <img src={logoUrl} style={{ width: 72, height: 72, borderRadius: 12, marginBottom: 16, objectFit: 'contain' }} alt="EXMAQ" />
        <div style={{ fontSize: 22, fontWeight: 500, color: '#f1f5f9' }}>Canal Arauco</div>
        <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Construcción Canal Siberia</div>
      </div>

      <div style={{ width: '100%', maxWidth: 380 }}>
        {editando ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, textAlign: 'center' }}>¿Cómo te llamas?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && guardarNombre()}
                style={{ flex: 1, background: '#1e293b', border: '0.5px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#f1f5f9', fontSize: 15 }}
                autoFocus
              />
              <button
                onClick={guardarNombre}
                disabled={!nombre.trim()}
                style={{ background: '#0ea5e9', border: 'none', borderRadius: 8, padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: 14, color: '#64748b' }}>Hola, </span>
            <span style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{nombreGuardado}</span>
            <button
              onClick={() => { setEditando(true); setNombre(''); }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cambiar
            </button>
          </div>
        )}

        {!editando && (
          <>
            <button onClick={() => navigate('/subir-fotos')}
              style={{ width: '100%', background: '#1e293b', border: '0.5px solid #334155', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 12, cursor: 'pointer', color: '#f1f5f9' }}>
              <div style={{ width: 48, height: 48, background: '#0f172a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>📷</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Subir fotos</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Registra el avance de obra</div>
              </div>
            </button>
            <button onClick={() => navigate('/recibir-camion')}
              style={{ width: '100%', background: '#1e293b', border: '0.5px solid #334155', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', color: '#f1f5f9' }}>
              <div style={{ width: 48, height: 48, background: '#0f172a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>🚛</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Recibir camión</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Control de hormigón en terreno</div>
              </div>
            </button>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', paddingBottom: '1rem' }}>
        <div style={{ borderTop: '0.5px solid #1e293b', marginBottom: '1.25rem', width: 200, margin: '0 auto 1.25rem' }}></div>
        <button onClick={() => navigate('/login')}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}>
          🔒 Iniciar sesión
        </button>
      </div>
    </div>
  );
}
