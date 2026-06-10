const LS_KEY = 'config_km';

const PREFIJOS = { tramo: 'TRAMO', caida: 'CAIDA', atravieso: 'ATRAVIESO' };

function kmKey(tipo, id) {
  const prefijo = PREFIJOS[tipo] ?? tipo.toUpperCase();
  return `${prefijo}_${String(id).toUpperCase()}`;
}

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function useKm(tipo, id) {
  const config = readConfig();
  return config[kmKey(tipo, id)] ?? { kmInicio: '', kmFin: '' };
}

export function getKm(tipo, id) {
  const config = readConfig();
  return config[kmKey(tipo, id)] ?? { kmInicio: '', kmFin: '' };
}

export { LS_KEY, kmKey };
