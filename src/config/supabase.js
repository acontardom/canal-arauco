import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// TODO: quitar este log antes de producción
console.log('[Supabase] URL detectada:', supabaseUrl ?? '(no definida)');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables de entorno no configuradas — modo offline únicamente.');
}

// Timeout explícito más largo para el fetch del cliente (evita cortes prematuros
// antes de que la consulta termine en el servidor).
function fetchConTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchConTimeout },
    })
  : null;
