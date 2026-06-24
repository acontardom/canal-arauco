import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';
import { db } from '../db/database';
import { supabase } from '../config/supabase';
import Protocolo from './Protocolo';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

export default function GenerarProtocolo() {
  const navigate = useNavigate();

  const [tipo, setTipo]           = useState('tramo');
  const [entidadId, setEntidadId] = useState(String(TRAMOS[0]));
  const [protocoloId, setProtocoloId] = useState('');
  const [protocoloLocal, setProtocoloLocal] = useState(null);

  useEffect(() => {
    if (!protocoloId) { setProtocoloLocal(null); return; }
    const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;
    db.protocolos
      .where('entidadId').equals(entidadIdReal)
      .filter(p => p.tipo === tipo && p.protocoloId === protocoloId)
      .first()
      .then(p => setProtocoloLocal(p ?? null));
  }, [tipo, entidadId, protocoloId]);

  useEffect(() => {
    if (!protocoloLocal?.supabaseId || !supabase) return;

    const sincronizarEstado = async () => {
      const { data } = await supabase
        .from('protocolos')
        .select('estado, observacion_ito, firma_token, firma_imagen_url, firma_fecha, pdf_firmado_url')
        .eq('id', protocoloLocal.supabaseId)
        .single();

      if (!data) return;
      if (data.estado === protocoloLocal.estado) return;

      await db.protocolos.update(protocoloLocal.id, {
        estado:         data.estado,
        observacionIto: data.observacion_ito  ?? null,
        firmaToken:     data.firma_token       ?? null,
        firmaImagenUrl: data.firma_imagen_url  ?? null,
        firmaFecha:     data.firma_fecha        ?? null,
        pdfFirmadoUrl:  data.pdf_firmado_url   ?? null,
        sincronizada:   true,
      });

      window.location.reload();
    };

    sincronizarEstado();
  }, [protocoloLocal?.supabaseId]);

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
          {PROTOCOLOS.map(p => (
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
