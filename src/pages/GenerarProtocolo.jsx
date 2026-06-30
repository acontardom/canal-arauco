import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';
import { db } from '../db/database';
import { supabase } from '../config/supabase';
import Protocolo from './Protocolo';

async function cargarProtocolo(tipo, entidadId, protocoloId) {
  if (navigator.onLine && supabase) {
    try {
      const { data } = await supabase
        .from('protocolos')
        .select('*')
        .eq('tipo', tipo)
        .eq('entidad_id', String(entidadId))
        .eq('protocolo_id', protocoloId)
        .single();

      if (data) {
        const local = await db.protocolos
          .filter(p => p.protocoloId === protocoloId &&
            String(p.entidadId) === String(entidadId) &&
            p.tipo === tipo)
          .first();

        if (local) {
          await db.protocolos.update(local.id, {
            estado:         data.estado,
            datos:          data.datos,
            observacionIto: data.observacion_ito  ?? null,
            firmaToken:     data.firma_token       ?? null,
            firmaImagenUrl: data.firma_imagen_url  ?? null,
            pdfFirmadoUrl:  data.pdf_firmado_url   ?? null,
            sincronizada:   true,
          });
        }
        return data;
      }
    } catch (err) {
      console.warn('[GenerarProtocolo] Error Supabase, usando Dexie:', err?.message);
    }
  }

  return db.protocolos
    .filter(p => p.protocoloId === protocoloId &&
      String(p.entidadId) === String(entidadId) &&
      p.tipo === tipo)
    .first();
}

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

export default function GenerarProtocolo() {
  const navigate = useNavigate();

  const [tipo, setTipo]           = useState('tramo');
  const [entidadId, setEntidadId] = useState(String(TRAMOS[0]));
  const [protocoloId, setProtocoloId] = useState('');
  const [protocoloLocal, setProtocoloLocal] = useState(null);
  const [estadoReal, setEstadoReal]         = useState(null);
  const [observacionReal, setObservacionReal] = useState(null);
  const [tieneRadier, setTieneRadier] = useState(false);

  useEffect(() => {
    if (!supabase || !navigator.onLine) { setTieneRadier(true); return; }
    const entidadIdQuery = tipo === 'caida' ? Number(entidadId) : String(entidadId);
    supabase
      .from('avance')
      .select('partida_id')
      .eq('tipo_entidad', tipo)
      .eq('entidad_id', entidadIdQuery)
      .eq('partida_id', 'hormigon_radier')
      .then(({ data }) => setTieneRadier((data?.length ?? 0) > 0));
  }, [tipo, entidadId]);

  useEffect(() => {
    if (!protocoloId) { setProtocoloLocal(null); setEstadoReal(null); setObservacionReal(null); return; }

    cargarProtocolo(tipo, entidadId, protocoloId).then(data => {
      setProtocoloLocal(data ?? null);
      if (data) {
        setEstadoReal(data.estado ?? null);
        setObservacionReal(data.observacion_ito ?? data.observacionIto ?? null);
      } else {
        setEstadoReal(null);
        setObservacionReal(null);
      }
    });
  }, [tipo, entidadId, protocoloId]);

  const estadoActual     = estadoReal     ?? protocoloLocal?.estado;
  const observacionActual = observacionReal ?? protocoloLocal?.observacionIto;

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo);
    setEntidadId(String(LISTAS[nuevoTipo][0]));
    setProtocoloId('');
  }

  function handleEntidadChange(nuevoId) {
    setEntidadId(nuevoId);
    setProtocoloId('');
  }

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Generar Protocolo</h1>

      <div style={s.row}>
        <div style={s.campo}>
          <label style={s.label}>Tipo</label>
          <select style={s.input} value={tipo} onChange={e => handleTipoChange(e.target.value)}>
            <option value="tramo">Tramo</option>
            <option value="caida">Caída</option>
            <option value="atravieso">Atravieso</option>
          </select>
        </div>
        <div style={s.campo}>
          <label style={s.label}>Entidad</label>
          <select style={s.input} value={entidadId} onChange={e => handleEntidadChange(e.target.value)}>
            {LISTAS[tipo].map(id => (
              <option key={id} value={id}>{NOMBRE_TIPO[tipo]} {id}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={s.campo}>
        <label style={s.label}>Protocolo</label>
        <select style={s.input} value={protocoloId} onChange={e => setProtocoloId(e.target.value)}>
          <option value="">Seleccionar...</option>
          {PROTOCOLOS.filter(p => {
            if (p.id === 'COTAS' && !tieneRadier) return false;
            if (p.id === 'PICE4_MURO' && tipo === 'tramo') return false;
            return true;
          }).map(p => (
            <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>
          ))}
        </select>
      </div>

      {protocoloId && (
        <Protocolo
          key={`${tipo}-${entidadId}-${protocoloId}`}
          tipo={tipo}
          entidadId={entidadId}
          protocoloId={protocoloId}
          embedded
        />
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '40px' },

  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: 0, alignSelf: 'flex-start',
  },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  row: { display: 'flex', gap: '10px' },
  campo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
};
