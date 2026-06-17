import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';
import { supabase } from '../config/supabase';

// ─── Orden y etiquetas de columnas ────────────────────────────────────────────

const ORDEN_MATRIZ = [
  'PICE1', 'G5', 'PICE4_RADIER', 'PICE4_MURO', 'PICE3', 'PICE2_RADIER', 'PICE2_MURO', 'HA_RADIER', 'HA_MURO',
];

const PROTOCOLOS_MATRIZ = ORDEN_MATRIZ.map(id => PROTOCOLOS.find(p => p.id === id));

const COL_LABEL = {
  PICE1:        'Excavación',
  G5:           'Emplantillado',
  PICE4_RADIER: 'Enfierr. Radier',
  PICE4_MURO:   'Enfierr. Muro',
  PICE3:        'Moldajes',
  PICE2_RADIER: 'Horm. Radier',
  PICE2_MURO:   'Horm. Muro',
  HA_RADIER:    'H.A. Radier',
  HA_MURO:      'H.A. Muro',
};

// ─── Mapeo protocolo → partida de avance ──────────────────────────────────────
// HA_RADIER / HA_MURO no tienen partida de avance correspondiente

const PROTOCOLO_A_PARTIDA = {
  PICE1:        'excavacion',
  G5:           'emplantillado',
  PICE4_RADIER: 'enfierradura',
  PICE4_MURO:   'enfierradura',
  PICE2_RADIER: 'hormigon_radier',
  PICE3:        'moldaje',
  PICE2_MURO:   'hormigon_muro',
};

// ─── Estados y colores ────────────────────────────────────────────────────────

const ESTADOS = {
  sin_iniciar: { label: 'Sin iniciar',       color: '#2a2a3e' },
  por_protoc:  { label: 'Por protocolizar',  color: '#e6a817' },
  listo:       { label: 'Protocolo listo',   color: '#3d7ebf' },
  enviado:     { label: 'Enviado EDP',       color: '#27ae60' },
};

function calcEstado(protEstado, recepcionada) {
  if (protEstado === 'enviado')    return 'enviado';
  if (protEstado === 'completado') return 'listo';
  if (recepcionada)                return 'por_protoc';
  return 'sin_iniciar';
}

// ─── Componentes de tabla ─────────────────────────────────────────────────────

const isMobile = window.innerWidth < 768;

function MatrizCell({ tipo, entidadId, protocolo, protMap, avanceSet, navigate, nombreEntidad }) {
  const protEstado   = protMap[`${tipo}-${entidadId}-${protocolo.id}`];
  const partidaId    = PROTOCOLO_A_PARTIDA[protocolo.id];
  const recepcionada = partidaId ? avanceSet.has(`${tipo}-${String(entidadId)}-${partidaId}`) : false;
  const estado       = calcEstado(protEstado, recepcionada);
  const { label, color } = ESTADOS[estado];

  return (
    <td
      style={{ ...s.celda, background: color }}
      title={`${nombreEntidad} — ${protocolo.nombre}: ${label}`}
      onClick={() => navigate(`/protocolo/${tipo}/${entidadId}/${protocolo.id}`)}
    />
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: `${ROW_HEADER_W}px` }} />
      {PROTOCOLOS_MATRIZ.map(p => <col key={p.id} />)}
    </colgroup>
  );
}

function EncabezadoColumnas() {
  return (
    <tr>
      <th style={s.cornerCell} />
      {PROTOCOLOS_MATRIZ.map(p => (
        <th key={p.id} style={s.colHeader}>{COL_LABEL[p.id]}</th>
      ))}
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardMatriz() {
  const navigate = useNavigate();

  const [protMap, setProtMap]     = useState({});
  const [avanceSet, setAvanceSet] = useState(new Set());

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('protocolos').select('tipo,entidad_id,protocolo_id,estado'),
      supabase.from('avance').select('tipo_entidad,entidad_id,partida_id'),
    ]).then(([{ data: prots }, { data: avance }]) => {
      const pMap = {};
      for (const p of prots ?? []) {
        pMap[`${p.tipo}-${p.entidad_id}-${p.protocolo_id}`] = p.estado;
      }
      setProtMap(pMap);
      setAvanceSet(new Set(
        (avance ?? []).map(r => `${r.tipo_entidad}-${String(r.entidad_id)}-${r.partida_id}`)
      ));
    });
  }, []);

  const cellProps = { protMap, avanceSet, navigate };

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Matriz de Protocolos</h1>

      <div style={s.leyenda}>
        {Object.entries(ESTADOS).map(([key, { label, color }]) => (
          <span key={key} style={s.leyendaItem}>
            <span style={{ ...s.swatch, background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div style={s.contenedor}>
        {/* ── Tabla TRAMOS ──────────────────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup />
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ.length + 1} style={s.tituloTabla}>TRAMOS</th>
              </tr>
              <EncabezadoColumnas />
            </thead>
            <tbody>
              {TRAMOS.map(tramoId => (
                <tr key={tramoId}>
                  <th style={s.rowHeader}>{tramoId}</th>
                  {PROTOCOLOS_MATRIZ.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="tramo"
                      entidadId={tramoId}
                      protocolo={p}
                      nombreEntidad={`Tramo ${tramoId}`}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Tabla CAÍDAS + ATRAVIESOS ────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup />
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ.length + 1} style={s.tituloTabla}>CAÍDAS</th>
              </tr>
              <EncabezadoColumnas />
            </thead>
            <tbody>
              {CAIDAS.map(caidaId => (
                <tr key={caidaId}>
                  <th style={s.rowHeader}>{caidaId}</th>
                  {PROTOCOLOS_MATRIZ.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="caida"
                      entidadId={caidaId}
                      protocolo={p}
                      nombreEntidad={`Caída ${caidaId}`}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}

              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ.length + 1} style={s.separadorFila}>ATRAVIESOS</th>
              </tr>

              {ATRAVIESOS.map(atId => (
                <tr key={atId}>
                  <th style={s.rowHeader}>{`AT${atId}`}</th>
                  {PROTOCOLOS_MATRIZ.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="atravieso"
                      entidadId={atId}
                      protocolo={p}
                      nombreEntidad={`Atravieso ${atId}`}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CELL = 32;
const ROW_HEADER_W = 44;
const HEADER_H = 130;

const s = {
  page: { maxWidth: '1120px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' },

  leyenda: { display: 'flex', gap: '28px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#ccd6f6' },
  swatch: { width: '18px', height: '18px', borderRadius: '4px', display: 'inline-block', border: '1px solid #0f3460' },

  contenedor: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '24px',
    justifyContent: 'center',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  },
  tablaWrap: {
    flex: isMobile ? '1 1 100%' : '0 1 48%',
    maxWidth: isMobile ? 'none' : '520px',
    overflowX: 'auto',
    border: '1px solid #0f3460',
    borderRadius: '10px',
    marginBottom: isMobile ? '8px' : 0,
  },
  tabla: { borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: '360px' },

  tituloTabla: {
    background: '#0f3460', color: '#64ffda', fontSize: '17px', fontWeight: 800,
    textAlign: 'center', padding: '12px 0', letterSpacing: '2px', textTransform: 'uppercase',
  },
  separadorFila: {
    background: '#1e3a5f', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    textAlign: 'center', padding: '8px 0', letterSpacing: '1.5px',
  },
  colHeader: {
    height: `${HEADER_H}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '15px', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle',
    border: '1px solid #1a1a2e', padding: '8px 4px',
    writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
  },
  cornerCell: {
    width: `${ROW_HEADER_W}px`, background: '#0f3460', border: '1px solid #1a1a2e',
  },
  rowHeader: {
    width: `${ROW_HEADER_W}px`, height: `${CELL}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '12px', fontWeight: 700, textAlign: 'center', border: '1px solid #1a1a2e', padding: '6px 4px',
  },
  celda: {
    height: `${CELL}px`, minWidth: `${CELL}px`, border: '1px solid #1a1a2e',
    padding: '8px', cursor: 'pointer', boxSizing: 'border-box',
  },
};
