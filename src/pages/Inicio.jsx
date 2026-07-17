import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import { db } from '../db/database';
import { USUARIOS } from '../constants/estructura';
import { fechaHoy } from '../utils/fecha';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

export default function Inicio() {
  const { usuario, seleccionarUsuario } = useUser();
  const { session, usuario: usuarioAuth } = useAuth();
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

  return (
    <div style={s.page}>
      {(usuario || session) ? (
        <div style={s.saludo}>
          <h1 style={s.saludoTexto}>Hola{usuarioAuth?.nombre ? `, ${usuarioAuth.nombre}` : ''} 👋</h1>
        </div>
      ) : (
        <div style={s.selector}>
          <h1 style={s.titulo}>¿Quién eres?</h1>
          <p style={s.subtitulo}>Selecciona tu nombre para continuar</p>
          <div style={s.usuarios}>
            {USUARIOS.map(nombre => (
              <button key={nombre} style={s.btnUsuario} onClick={() => seleccionarUsuario(nombre)}>
                {nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {(usuario || session) && (
        <>
          <section style={s.bloqueTerreno}>
            <h2 style={s.bloqueTitulo}>Terreno</h2>
            <button style={s.btnTerreno} onClick={() => navigate('/subir-fotos')}>
              📷 Subir Fotos
            </button>
            <button style={s.btnTerreno} onClick={() => navigate('/recibir-camion')}>
              🚛 Recibir Camión
            </button>
            <div style={s.divisor} />
            <button style={s.btnTerreno} onClick={() => navigate('/recepcionar-avance')}>
              ✅ Recepcionar Avance
            </button>
          </section>

          <section style={s.bloqueGestion}>
            <h2 style={s.bloqueTitulo}>Gestión</h2>
            <button style={s.btnGestion} onClick={() => navigate('/vista-canal')}>
              🗺️ Vista Canal
            </button>
            <button style={s.btnGestion} onClick={() => navigate('/matriz')}>
              📊 Matriz
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
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },

  saludo: { display: 'flex', alignItems: 'center' },
  saludoTexto: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  selector: { background: '#16213e', borderRadius: '14px', padding: '24px', border: '1px solid #0f3460' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' },
  subtitulo: { color: '#8892b0', fontSize: '13px', margin: '0 0 16px' },
  usuarios: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnUsuario: {
    background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f',
    borderRadius: '10px', padding: '14px 16px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
  },

  divisor: { borderTop: '1px solid rgba(100,255,218,0.12)', margin: '2px 0' },

  bloqueTerreno: {
    background: 'linear-gradient(135deg, #0f3460, #16213e)',
    border: '1px solid #1e3a5f', borderRadius: '16px', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  bloqueTitulo: { color: '#64ffda', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 },
  btnTerreno: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '12px',
    padding: '20px 18px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
    textAlign: 'left', boxShadow: '0 4px 14px rgba(100,255,218,0.18)',
  },

  bloqueGestion: {
    background: '#16213e',
    border: '1px solid #1e3a5f', borderRadius: '16px', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  btnGestion: {
    background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f',
    borderRadius: '10px', padding: '14px 16px', fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', textAlign: 'left',
  },
  bloqueActividad: { display: 'flex', flexDirection: 'column', gap: '10px' },
  actividadLista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  actividadItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '10px 14px',
  },
  actividadTexto: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600 },
  actividadEstado: { fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  sinActividad: { color: '#8892b0', fontSize: '13px', margin: 0 },
};
