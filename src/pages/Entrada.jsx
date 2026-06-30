import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import logoUrl from '../assets/Logo_ExMaq.jpg';
import BottomNav from '../components/BottomNav';
import { db } from '../db/database';
import { fechaHoy } from '../utils/fecha';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

export default function Entrada() {
  const [nombre, setNombre] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState('');
  const [editando, setEditando] = useState(false);
  const navigate = useNavigate();

  const hoy = fechaHoy();

  const actividad = useLiveQuery(async () => {
    const [fotos, camiones] = await Promise.all([
      db.fotos_terreno.filter(f => f.fechaCaptura?.startsWith(hoy)).toArray(),
      db.camiones.filter(c => c.fechaRecepcion?.startsWith(hoy)).toArray(),
    ]);

    const grupos = {};
    for (const f of fotos) {
      const key = `${f.tipo}-${f.entidadId}`;
      if (!grupos[key]) grupos[key] = { tipo: f.tipo, entidadId: f.entidadId, count: 0, sincronizado: true };
      grupos[key].count += 1;
      if (!f.subidaStorage) grupos[key].sincronizado = false;
    }

    return { fotos: Object.values(grupos), camiones };
  }, [hoy]);

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
    <div style={s.page}>
      <div style={s.header}>
        <img src={logoUrl} style={s.logo} alt="EXMAQ" />
        <div style={s.appNombre}>Canal Arauco</div>
        <div style={s.appSub}>Construcción Canal Siberia</div>
      </div>

      <div style={s.contenido}>
        {editando ? (
          <div style={s.nombreBox}>
            <div style={s.nombreLabel}>¿Cómo te llamas?</div>
            <div style={s.nombreRow}>
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && guardarNombre()}
                style={s.input}
                autoFocus
              />
              <button onClick={guardarNombre} disabled={!nombre.trim()} style={s.btnListo}>
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div style={s.saludo}>
            <span style={s.saludoLabel}>Hola, </span>
            <span style={s.saludoNombre}>{nombreGuardado}</span>
            <button onClick={() => { setEditando(true); setNombre(''); }} style={s.btnCambiar}>
              Cambiar
            </button>
          </div>
        )}

        {!editando && (
          <>
            <section style={s.bloqueTerreno}>
              <h2 style={s.bloqueTitulo}>Terreno</h2>
              <button style={s.btnTerreno} onClick={() => navigate('/subir-fotos')}>
                📷 Subir Fotos
              </button>
              <button style={s.btnTerreno} onClick={() => navigate('/recibir-camion')}>
                🚛 Recibir Camión
              </button>
            </section>

            <section style={s.bloqueActividad}>
              <h2 style={s.bloqueTitulo}>Actividad de hoy</h2>
              {actividad && (actividad.fotos.length > 0 || actividad.camiones.length > 0) ? (
                <div style={s.actividadLista}>
                  {actividad.fotos.map(g => (
                    <div key={`foto-${g.tipo}-${g.entidadId}`} style={s.actividadItem}>
                      <span style={s.actividadTexto}>
                        📷 {g.count} {g.count === 1 ? 'foto' : 'fotos'} — {NOMBRE_TIPO[g.tipo]} {g.entidadId}
                      </span>
                      <span style={{ ...s.actividadEstado, color: g.sincronizado ? '#10b981' : '#f59e0b' }}>
                        {g.sincronizado ? '✅ sincronizado' : '🔄 pendiente'}
                      </span>
                    </div>
                  ))}
                  {actividad.camiones.map(c => (
                    <div key={`camion-${c.id}`} style={s.actividadItem}>
                      <span style={s.actividadTexto}>
                        🚛 {c.tipoHormigon} — {NOMBRE_TIPO[c.tipoEntidad]} {c.entidadId}{c.numeroGuia ? ` — Guía ${c.numeroGuia}` : ''}
                      </span>
                      <span style={{ ...s.actividadEstado, color: c.sincronizado ? '#10b981' : '#f59e0b' }}>
                        {c.sincronizado ? '✅ sincronizado' : '🔄 pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={s.sinActividad}>Sin actividad hoy</p>
              )}
            </section>
          </>
        )}
      </div>

      {nombreGuardado && <BottomNav />}
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-background-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem 1.5rem 80px',
    gap: '1.5rem',
  },

  header: { textAlign: 'center', marginTop: '1rem' },
  logo: { width: 72, height: 72, borderRadius: 12, marginBottom: 16, objectFit: 'contain' },
  appNombre: { fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' },
  appSub:    { fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 },

  contenido: { width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '20px' },

  nombreBox: {},
  nombreLabel: { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8, textAlign: 'center' },
  nombreRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--color-text-primary)',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
  },
  btnListo: {
    background: '#64ffda',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    color: '#0a1f3a',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
  },

  saludo: { textAlign: 'center' },
  saludoLabel:  { fontSize: 14, color: 'var(--color-text-secondary)' },
  saludoNombre: { fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 700 },
  btnCambiar: {
    background: 'none', border: 'none', color: 'var(--color-text-secondary)',
    fontSize: 13, marginLeft: 8, cursor: 'pointer', textDecoration: 'underline',
    fontFamily: 'inherit',
  },

  bloqueTerreno: {
    background: 'linear-gradient(135deg, #0f3460, #16213e)',
    border: '1px solid #1e3a5f', borderRadius: '16px', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  bloqueTitulo: {
    color: '#64ffda', fontSize: '13px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0,
  },
  btnTerreno: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '12px',
    padding: '20px 18px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
    textAlign: 'left', boxShadow: '0 4px 14px rgba(100,255,218,0.18)',
    fontFamily: 'inherit',
  },

  bloqueActividad: { display: 'flex', flexDirection: 'column', gap: '10px' },
  actividadLista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  actividadItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    background: 'var(--color-background-secondary)',
    border: '1px solid #0f3460', borderRadius: '10px', padding: '10px 14px',
  },
  actividadTexto:  { color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 600 },
  actividadEstado: { fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  sinActividad:    { color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 },
};
