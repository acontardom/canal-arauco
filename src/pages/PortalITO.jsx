import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { PROTOCOLOS } from '../constants/estructura';

const NOMBRE_PROTOCOLO = Object.fromEntries(PROTOCOLOS.map(p => [p.id, p.nombre]));
const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function ProtocoloCard({ p, accion, labelAccion }) {
  const nombre = NOMBRE_PROTOCOLO[p.protocolo_id] ?? p.protocolo_id;
  const entidad = `${NOMBRE_TIPO[p.tipo] ?? p.tipo} ${p.entidad_id}`;
  return (
    <div style={s.card}>
      <div style={s.cardInfo}>
        <div style={s.cardNombre}>{nombre}</div>
        <div style={s.cardMeta}>{entidad} · {fmtFecha(p.fecha_modificacion)}</div>
      </div>
      {accion && (
        <button style={s.btnAccion} onClick={accion}>{labelAccion}</button>
      )}
    </div>
  );
}

export default function PortalITO() {
  const { usuario, signOut } = useAuth();
  const [pendientes,  setPendientes]  = useState([]);
  const [firmados,    setFirmados]    = useState([]);
  const [rechazados,  setRechazados]  = useState([]);
  const [cargando,    setCargando]    = useState(true);

  useEffect(() => { cargarProtocolos(); }, []);

  async function cargarProtocolos() {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('protocolos')
        .select('id, tipo, entidad_id, protocolo_id, estado, fecha_modificacion')
        .in('estado', ['enviado_ito', 'firmado', 'con_observaciones'])
        .order('fecha_modificacion', { ascending: false });
      if (error) throw error;
      setPendientes(data?.filter(p => p.estado === 'enviado_ito')        ?? []);
      setFirmados(  data?.filter(p => p.estado === 'firmado')            ?? []);
      setRechazados(data?.filter(p => p.estado === 'con_observaciones')  ?? []);
    } catch (err) {
      console.error('[PortalITO]', err?.message ?? err);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Portal ITO</h1>
          {usuario && <p style={s.bienvenida}>Bienvenido, {usuario.nombre ?? usuario.email}</p>}
        </div>
        <button style={s.btnSalir} onClick={signOut}>Cerrar sesión</button>
      </div>

      {cargando ? (
        <p style={s.cargando}>Cargando protocolos...</p>
      ) : (
        <>
          <Seccion titulo="Pendientes de firma" count={pendientes.length} color="#e6a817">
            {pendientes.length === 0
              ? <p style={s.empty}>No hay protocolos pendientes.</p>
              : pendientes.map(p => (
                  <ProtocoloCard
                    key={p.id}
                    p={p}
                    labelAccion="Ver y Firmar"
                    accion={() => alert('Firma digital — próximamente')}
                  />
                ))
            }
          </Seccion>

          <Seccion titulo="Firmados" count={firmados.length} color="#10b981">
            {firmados.length === 0
              ? <p style={s.empty}>No hay protocolos firmados.</p>
              : firmados.map(p => (
                  <ProtocoloCard
                    key={p.id}
                    p={p}
                    labelAccion="Ver PDF"
                    accion={() => alert('Ver PDF — próximamente')}
                  />
                ))
            }
          </Seccion>

          <Seccion titulo="Con observaciones" count={rechazados.length} color="#ef4444">
            {rechazados.length === 0
              ? <p style={s.empty}>Sin protocolos con observaciones.</p>
              : rechazados.map(p => (
                  <ProtocoloCard key={p.id} p={p} />
                ))
            }
          </Seccion>
        </>
      )}
    </div>
  );
}

function Seccion({ titulo, count, color, children }) {
  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={{ ...s.seccionTitulo, color }}>{titulo}</h2>
        <span style={{ ...s.badge, background: color }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

const s = {
  page: {
    maxWidth: '640px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    paddingBottom: '40px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },
  bienvenida: { color: '#8892b0', fontSize: '13px', margin: '4px 0 0' },
  btnSalir: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
    flexShrink: 0,
  },

  cargando: { color: '#8892b0', fontSize: '14px', textAlign: 'center', marginTop: '40px' },
  empty:    { color: '#8892b0', fontSize: '13px', margin: 0, fontStyle: 'italic' },

  seccion: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  seccionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  seccionTitulo: {
    fontSize: '14px',
    fontWeight: 800,
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  badge: {
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '2px 8px',
    minWidth: '24px',
    textAlign: 'center',
  },

  card: {
    background: '#0a1428',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  cardInfo:   { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 },
  cardNombre: { color: '#ccd6f6', fontSize: '13px', fontWeight: 700 },
  cardMeta:   { color: '#8892b0', fontSize: '12px' },
  btnAccion: {
    background: '#0f3460',
    border: '1px solid #1e3a5f',
    borderRadius: '7px',
    color: '#64ffda',
    fontSize: '12px',
    fontWeight: 700,
    padding: '8px 12px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
};
