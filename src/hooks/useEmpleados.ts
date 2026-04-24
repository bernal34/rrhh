import { useCallback, useEffect, useState } from 'react';
import {
  Empleado,
  darDeBaja,
  listEmpleados,
  upsertEmpleado,
} from '@/services/empleadosService';

export type EmpleadoFiltros = { sucursal_id?: string; estatus?: string; q?: string };

export function useEmpleados(filtros: EmpleadoFiltros = {}) {
  const [data, setData] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listEmpleados({
        sucursal_id: filtros.sucursal_id,
        estatus: filtros.estatus,
      });
      const q = filtros.q?.trim().toLowerCase();
      const filtered = q
        ? rows.filter((r) =>
            [r.nombre, r.apellido_paterno, r.apellido_materno, r.codigo, r.rfc, r.curp]
              .filter(Boolean)
              .some((v) => v!.toLowerCase().includes(q)),
          )
        : rows;
      setData(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  }, [filtros.sucursal_id, filtros.estatus, filtros.q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    save: async (emp: Partial<Empleado>) => {
      const saved = await upsertEmpleado(emp);
      await refresh();
      return saved;
    },
    baja: async (id: string, motivo: string) => {
      await darDeBaja(id, motivo);
      await refresh();
    },
  };
}
