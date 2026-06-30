import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { supabase } from '../config/supabase';
import { PROTOCOLOS } from '../constants/estructura';

const ESTADO = {
  completado: { icono: '●', color: '#10b981', label: 'Completado' },
  borrador:   { icono: '◐', color: '#f59e0b', label: 'Borrador' },
  pendiente:  { icono: '○', color: '#8892b0', label: 'Pendiente' },
};

export default function TramoDetalle() {
  const { tramoId } = useParams();
  const navigate = useNavigate();

  const protocolos = useLiveQuery(
    () => db.protocolos.where('entidadId').equals(tramoId).toArray(),
    [tramoId]
  ) ?? [];

  // Hidrata Dexie con estado fresco desde Supabase al abrir el tramo
  useEffect(() => {
    if (!navigator.onLine || !supabase) return;
    supabase
      .from('protocolos')
      .select('id, tipo, entidad_id, protocolo_id, estado, fecha_modificacion, datos, observacion_ito, firma_token, firma_imagen_url, pdf_firmado_url')
      .eq('entidad_id', tramoId)
      .eq('tipo', 'tramo')
      .then(async ({ data }) => {
        if (!data) return;
        for (const remoto of data) {
          const local = await db.protocolos
            .filter(p => p.protocoloId === remoto.protocolo_id &&
              String(p.entidadId) === String(remoto.entidad_id) &&
              p.tipo === remoto.tipo)
            .first();
          if (local) {
            await db.protocolos.update(local.id, {
              estado:         remoto.estado,
              datos:          remoto.datos,
              observacionIto: remoto.observacion_ito ?? null,
              firmaToken:     remoto.firma_token     ?? null,
              pdfFirmadoUrl:  remoto.pdf_firmado_url ?? null,
              sincronizada:   true,
            });
          }
        }
      });
  }, [tramoId]);

  const estadoPor = Object.fromEntries(protocolos.map(p => [p.protocoloId, p.estado]));
  const completados = PROTOCOLOS.filter(p => estadoPor[p.id] === 'completado').length;
  const color = completados === 0 ? '#ef4444' : completados === PROTOCOLOS.length ? '#10b981' : '#f59e0b';

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/tramos')}>← Tramos</button>

      <div style={s.header}>
        <h1 style={s.titulo}>Tramo {tramoId}</h1>
        <span style={{ ...s.badge, color, borderColor: color }}>
          {completados}/{PROTOCOLOS.length} completados
        </span>
      </div>

      <div style={s.barraFondo}>
        <div style={{
          ...s.barraRelleno,
          width: `${(completados / PROTOCOLOS.length) * 100}%`,
          background: color,
        }} />
      </div>

      <div style={s.lista}>
        {PROTOCOLOS.map(protocolo => {
          const esG5 = protocolo.id === 'G5';
          const estado = estadoPor[protocolo.id] ?? 'pendiente';
          const { icono, color: c, label } = ESTADO[estado];

          return (
            <div
              key={protocolo.id}
              style={{ ...s.fila, opacity: esG5 ? 0.55 : 1, cursor: esG5 ? 'default' : 'pointer' }}
              onClick={esG5 ? undefined : () => navigate(`/protocolo/tramo/${tramoId}/${protocolo.id}`)}
            >
              <span style={{ color: c, fontSize: '18px', lineHeight: 1 }}>{icono}</span>
              <div style={s.filaInfo}>
                <span style={s.protNombre}>{protocolo.nombre}</span>
                {esG5
                  ? <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>Próximamente</span>
                  : <span style={{ color: c, fontSize: '12px', fontWeight: 600 }}>{label}</span>
                }
              </div>
              {!esG5 && <span style={s.chevron}>›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '640px', margin: '0 auto' },
  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: '0 0 20px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, margin: 0 },
  badge: {
    fontSize: '14px', fontWeight: 700, border: '1.5px solid',
    borderRadius: '8px', padding: '3px 12px',
  },
  barraFondo: { height: '6px', background: '#0f3460', borderRadius: '3px', marginBottom: '28px' },
  barraRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  fila: {
    background: '#16213e', borderRadius: '10px', padding: '16px 18px',
    border: '1px solid #0f3460', display: 'flex', alignItems: 'center',
    gap: '14px', cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  filaInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  protNombre: { color: '#ccd6f6', fontWeight: 600, fontSize: '14px' },
  chevron: { color: '#8892b0', fontSize: '20px' },
};
