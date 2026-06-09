const LS_KEY = 'config_km';

function kmKey(tipo, id) {
  return tipo === 'tramo'
    ? `TRAMO_${String(id).toUpperCase()}`
    : `CAIDA_${id}`;
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
