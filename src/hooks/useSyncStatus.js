import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { estaSincronizando } from '../utils/sync';

export function useSyncStatus() {
  const [tick, setTick] = useState(0);
  const [sincronizando, setSincronizando] = useState(estaSincronizando());

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);

    function onSyncStarted() {
      setSincronizando(true);
    }
    function onSyncCompleted() {
      setSincronizando(false);
      setTick(t => t + 1);
    }

    window.addEventListener('syncStarted', onSyncStarted);
    window.addEventListener('syncCompleted', onSyncCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener('syncStarted', onSyncStarted);
      window.removeEventListener('syncCompleted', onSyncCompleted);
    };
  }, []);

  const pendientes = useLiveQuery(async () => {
    const [fotosTerreno, camiones] = await Promise.all([
      db.fotos_terreno.filter(f => f.sincronizada !== true).count(),
      db.camiones.filter(c => c.sincronizado !== true).count(),
    ]);
    return fotosTerreno + camiones;
  }, [tick]) ?? 0;

  return {
    pendientes,
    sincronizando,
    todoSincronizado: pendientes === 0 && !sincronizando,
  };
}
