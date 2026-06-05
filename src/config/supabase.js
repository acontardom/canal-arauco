import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// TODO: quitar este log antes de producción
console.log('[Supabase] URL detectada:', supabaseUrl ?? '(no definida)');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables de entorno no configuradas — modo offline únicamente.');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
