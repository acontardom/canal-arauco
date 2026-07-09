import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';

const ORDEN_PROTOCOLO = {
  PICE1: 1, G5: 2, PICE4_RADIER: 3, PICE4_MURO: 4, PICE3: 5,
  PICE2_RADIER: 6, PICE2_MURO: 7, HA_RADIER: 8, HA_MURO: 9, COTAS: 10,
};

const NOMBRES_PROTOCOLO_EDP = {
  PICE1: 'Excavacion', G5: 'Emplantillado',
  PICE4_RADIER: 'Enfierradura_Radier', PICE4_MURO: 'Enfierradura_Muro',
  PICE3: 'Moldajes', PICE2_RADIER: 'Hormigones_Radier', PICE2_MURO: 'Hormigones_Muro',
  HA_RADIER: 'Control_HA_Radier', HA_MURO: 'Control_HA_Muro', COTAS: 'Cotas_Topograficas',
};

const COLUMNAS_EDP = [
  { id: 'PICE1',       label: 'Excav.'  },
  { id: 'G5',          label: 'Empl.'   },
  { id: 'PICE4_RADIER',label: 'Enf.R'  },
  { id: 'PICE4_MURO',  label: 'Enf.M'  },
  { id: 'PICE3',       label: 'Mold.'   },
  { id: 'PICE2_RADIER',label: 'H.Rad.' },
  { id: 'PICE2_MURO',  label: 'H.Muro' },
  { id: 'HA_RADIER',   label: 'HA.R'   },
  { id: 'HA_MURO',     label: 'HA.M'   },
  { id: 'COTAS',       label: 'Cotas'  },
];

const COLORES_EDP = {
  firmado:     '#5b21b6',
  enviado_edp: '#16a34a',
  enviado:     '#16a34a',
  default:     '#1e293b',
};

// ── Matriz ──────────────────────────────────────────────────────────────────

function MatrizEDP({ protocolos, seleccionados, onToggle, esAdmin }) {
  const protMap = {};
  protocolos.forEach(p => {
    const key = `${p.tipo}-${String(p.entidad_id)}-${p.protocolo_id}`;
    protMap[key] = p;
  });

  function renderCelda(tipo, entidadId, columna) {
    const key = `${tipo}-${String(entidadId)}-${columna.id}`;
    const proto = protMap[key];
    const estado = proto?.estado;
    const esFirmado   = estado === 'firmado';
    const esEnviado   = estado === 'enviado' || estado === 'enviado_edp';
    const estaSelec   = seleccionados.some(s => s.id === proto?.id);
    const clickable   = esAdmin && esFirmado;

    const bg = estaSelec      ? '#7c3aed'
      : esFirmado             ? COLORES_EDP.firmado
      : esEnviado             ? COLORES_EDP.enviado_edp
      : COLORES_EDP.default;

    return (
      <td
        key={columna.id}
        onClick={() => clickable && onToggle(proto)}
        style={{
          width: 28, height: 24,
          background: bg,
          border: estaSelec ? '2px solid #a78bfa' : '0.5px solid #1e3a5f',
          cursor: clickable ? 'pointer' : 'default',
          transition: 'opacity 0.15s',
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => { if (clickable) e.currentTarget.style.opacity = '0.75'; }}
        onMouseLeave={e => { if (clickable) e.currentTarget.style.opacity = '1'; }}
      />
    );
  }

  const thSt  = { padding: '4px 3px', textAlign: 'center', color: '#8892b0', fontWeight: 400, whiteSpace: 'nowrap', fontSize: 10 };
  const tdLbl = { padding: '2px 8px', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', color: '#ccd6f6' };

  function Tabla({ titulo, filas, tipoEntidad }) {
    return (
      <>
        <div style={ms.secLabel}>{titulo}</div>
        <table style={ms.tabla}>
          <thead>
            <tr>
              <th style={{ ...thSt, textAlign: 'left' }} />
              {COLUMNAS_EDP.map(col => <th key={col.id} style={thSt}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map(id => (
              <tr key={id}>
                <td style={tdLbl}>{id}</td>
                {COLUMNAS_EDP.map(col => renderCelda(tipoEntidad, id, col))}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <Tabla titulo="TRAMOS"    filas={TRAMOS}     tipoEntidad="tramo"     />
      <Tabla titulo="CAÍDAS"    filas={CAIDAS}     tipoEntidad="caida"     />
      <Tabla titulo="ATRAVIESOS" filas={ATRAVIESOS} tipoEntidad="atravieso" />
    </div>
  );
}

const ms = {
  secLabel: { fontWeight: 600, fontSize: 12, marginTop: 16, marginBottom: 6, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tabla:    { borderCollapse: 'collapse', fontSize: 11, marginBottom: '0.5rem' },
};

// ── Página principal ─────────────────────────────────────────────────────────

export default function GeneradorEDP() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [protocolos,  setProtocolos]  = useState([]);
  const [edps,        setEdps]        = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [numeroEdp,   setNumeroEdp]   = useState(null);
  const [generando,   setGenerando]   = useState(false);
  const [edpGenerado, setEdpGenerado] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data: protos } = await supabase
      .from('protocolos')
      .select('id, tipo, entidad_id, protocolo_id, estado, pdf_firmado_url, edp, firma_token')
      .in('estado', ['firmado', 'enviado', 'enviado_edp'])
      .order('entidad_id');
    setProtocolos(protos ?? []);

    const { data: edpsData } = await supabase
      .from('edp')
      .select('*, edp_protocolos(protocolo_id)')
      .order('numero', { ascending: false });
    console.log('[EDP] edpsData:', edpsData);
    console.log('[EDP] maxEdp:', edpsData?.[0]?.numero);
    console.log('[EDP] numeroEdp calculado:', (edpsData?.[0]?.numero ?? 0) + 1);
    setEdps(edpsData ?? []);

    const maxEdp = edpsData?.[0]?.numero ?? 0;
    setNumeroEdp(maxEdp + 1);
  }

  function onToggle(proto) {
    if (!proto) return;
    setSeleccionados(prev =>
      prev.some(s => s.id === proto.id)
        ? prev.filter(s => s.id !== proto.id)
        : [...prev, proto]
    );
  }

  async function generarEDP() {
    if (seleccionados.length === 0) return;
    setGenerando(true);
    try {
      const { data: edpNuevo, error } = await supabase
        .from('edp')
        .insert({ numero: numeroEdp, usuario_nombre: usuario?.nombre ?? 'Arturo Contardo' })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('edp_protocolos').insert(
        seleccionados.map(p => ({ edp_id: edpNuevo.id, protocolo_id: p.id }))
      );

      await supabase
        .from('protocolos')
        .update({ estado: 'enviado_edp', edp: numeroEdp })
        .in('id', seleccionados.map(p => p.id));

      setEdpGenerado(edpNuevo);
      setSeleccionados([]);
      await cargar();
    } catch (err) {
      console.error('[EDP] Error:', err);
      alert('Error al generar el EDP. Intenta nuevamente.');
    } finally {
      setGenerando(false);
    }
  }

  async function descargarZIP(edp) {
    alert('Descarga ZIP — se implementa en el siguiente paso');
  }

  async function descargarEDPAnterior(edp) {
    alert('Descarga EDP anterior — se implementa en el siguiente paso');
  }

  const numStr = numeroEdp != null ? String(numeroEdp).padStart(3, '0') : '...';

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>{esAdmin ? 'Generar EDP' : 'Estado de Pagos'}</h1>

      {/* Leyenda */}
      <div style={s.leyenda}>
        {esAdmin && <div style={{ fontSize: 11, color: '#8892b0' }}>Click en celda púrpura para seleccionar</div>}
        <div style={s.leyendaItem}>
          <div style={{ ...s.chip, background: '#5b21b6' }} />
          <span style={s.leyendaTexto}>Firmado{esAdmin ? ' (seleccionable)' : ''}</span>
        </div>
        <div style={s.leyendaItem}>
          <div style={{ ...s.chip, background: '#16a34a' }} />
          <span style={s.leyendaTexto}>Ya en EDP anterior</span>
        </div>
      </div>

      {/* Layout: Matriz + Panel */}
      <div style={s.layout}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MatrizEDP
            protocolos={protocolos}
            seleccionados={seleccionados}
            onToggle={onToggle}
            esAdmin={esAdmin}
          />
        </div>

        {esAdmin && (
          <div style={{ width: 300, flexShrink: 0 }}>
            <div style={s.panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontWeight: 500, color: '#ccd6f6' }}>EDP N°</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#64ffda' }}>{numStr}</span>
              </div>

              <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 6 }}>
                Seleccionados ({seleccionados.length})
              </div>

              <div style={s.listaSelec}>
                {seleccionados.length === 0 ? (
                  <div style={{ color: '#8892b0', fontSize: 12, textAlign: 'center', padding: '1rem 0' }}>
                    Haz click en celdas púrpura para seleccionar
                  </div>
                ) : seleccionados.map(p => (
                  <div key={p.id} style={s.itemSelec}>
                    <div>
                      <div style={{ fontSize: 12, color: '#ccd6f6' }}>{NOMBRES_PROTOCOLO_EDP[p.protocolo_id] ?? p.protocolo_id}</div>
                      <div style={{ fontSize: 11, color: '#8892b0' }}>
                        {p.tipo === 'tramo' ? 'Tramo' : p.tipo === 'caida' ? 'Caída' : 'Atravieso'} {p.entidad_id}
                      </div>
                    </div>
                    <button onClick={() => onToggle(p)} style={s.btnQuitar}>×</button>
                  </div>
                ))}
              </div>

              <button
                onClick={generarEDP}
                disabled={seleccionados.length === 0 || generando}
                style={{ ...s.btnGenerar, opacity: (seleccionados.length === 0 || generando) ? 0.5 : 1, cursor: seleccionados.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {generando ? 'Generando...' : `Generar EDP ${numStr}`}
              </button>

              {edpGenerado && (
                <button onClick={() => descargarZIP(edpGenerado)} style={s.btnDescargar}>
                  ↓ Descargar ZIP EDP {String(edpGenerado.numero).padStart(3, '0')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#ccd6f6' }}>Historial de EDPs</div>
        {edps.length === 0 ? (
          <div style={{ color: '#8892b0', fontSize: 13 }}>Sin EDPs generados aún.</div>
        ) : edps.map(edp => (
          <div key={edp.id} style={s.edpRow}>
            <div>
              <div style={{ fontWeight: 600, color: '#ccd6f6' }}>EDP N° {String(edp.numero).padStart(3, '0')}</div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                {edp.edp_protocolos?.length ?? 0} protocolos
                {edp.fecha_generacion ? ` · ${new Date(edp.fecha_generacion).toLocaleDateString('es-CL')}` : ''}
              </div>
            </div>
            <button onClick={() => descargarEDPAnterior(edp)} style={s.btnDescargarEdp}>
              ↓ Descargar ZIP
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  page:   { maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' },
  titulo: { color: '#ccd6f6', fontSize: 22, fontWeight: 700, marginBottom: 16, marginTop: 0 },

  leyenda:      { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' },
  leyendaItem:  { display: 'flex', alignItems: 'center', gap: 5 },
  leyendaTexto: { fontSize: 11, color: '#8892b0' },
  chip:         { width: 10, height: 10, borderRadius: 2 },

  layout: { display: 'flex', gap: '1.5rem', alignItems: 'flex-start' },

  panel: {
    background: '#16213e',
    borderRadius: 12,
    padding: '1rem',
    border: '1px solid #0f3460',
    position: 'sticky',
    top: 24,
  },
  listaSelec: { maxHeight: 220, overflowY: 'auto', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #0f3460' },
  itemSelec: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '0.5px solid #1e3a5f',
  },
  btnQuitar: { background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' },

  btnGenerar: {
    width: '100%', marginBottom: 8,
    background: 'rgba(16,185,129,0.1)', color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600,
  },
  btnDescargar: {
    width: '100%',
    background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  edpRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', background: '#16213e',
    borderRadius: 8, marginBottom: 8, border: '1px solid #0f3460',
  },
  btnDescargarEdp: {
    background: 'none', border: '0.5px solid #1e3a5f',
    borderRadius: 8, padding: '6px 12px',
    fontSize: 12, cursor: 'pointer', color: '#ccd6f6',
  },
};
