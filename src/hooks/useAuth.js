import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

export function useAuth() {
  const [session, setSession]   = useState(null);
  const [usuario, setUsuario]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) cargarUsuario(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarUsuario(session.user.id);
      else { setUsuario(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function cargarUsuario(id) {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single();
      setUsuario(data ?? null);
    } catch {
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    if (!supabase) return new Error('Sin conexión a Supabase');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ?? null;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function cambiarContrasena(nuevaClave) {
    if (!supabase) return new Error('Sin conexión a Supabase');
    const { error } = await supabase.auth.updateUser({ password: nuevaClave });
    return error ?? null;
  }

  return { session, usuario, loading, signIn, signOut, cambiarContrasena };
}
