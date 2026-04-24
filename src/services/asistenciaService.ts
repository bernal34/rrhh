import { supabase } from '@/lib/supabase';

export type AsistenciaRow = {
  fecha: string;
  empleado_id: string;
  empleado: string;
  codigo: string | null;
  sucursal: string | null;
  turno: string | null;
  hora_entrada_esperada: string | null;
  hora_salida_esperada: string | null;
  entrada_real: string | null;
  salida_real: string | null;
  minutos_retardo: number | null;
  minutos_trabajados: number | null;
  falta: boolean;
  incidencia: string | null;
  estatus: 'descanso' | 'falta' | 'retardo' | 'puntual' | 'pendiente';
};

export async function recalcularAsistencia(desde: string, hasta: string, empleadoId?: string) {
  const { data, error } = await supabase.rpc('fn_compute_asistencia_rango', {
    p_desde: desde,
    p_hasta: hasta,
    p_empleado_id: empleadoId ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function getAsistencia(filtros: {
  desde: string;
  hasta: string;
  sucursal?: string;
  empleadoId?: string;
  estatus?: string;
}) {
  let q = supabase
    .from('v_reporte_asistencia')
    .select('*')
    .gte('fecha', filtros.desde)
    .lte('fecha', filtros.hasta)
    .order('fecha', { ascending: false })
    .order('empleado');

  if (filtros.sucursal) q = q.eq('sucursal', filtros.sucursal);
  if (filtros.empleadoId) q = q.eq('empleado_id', filtros.empleadoId);
  if (filtros.estatus) q = q.eq('estatus', filtros.estatus);

  const { data, error } = await q;
  if (error) throw error;
  return data as AsistenciaRow[];
}

export function toCsv(rows: AsistenciaRow[]) {
  const headers = [
    'Fecha', 'Empleado', 'Código', 'Sucursal', 'Turno',
    'Entrada esperada', 'Salida esperada', 'Entrada real', 'Salida real',
    'Retardo (min)', 'Trabajados (min)', 'Estatus', 'Incidencia',
  ];
  const escape = (v: unknown) =>
    v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.fecha, r.empleado, r.codigo, r.sucursal, r.turno,
        r.hora_entrada_esperada, r.hora_salida_esperada,
        r.entrada_real, r.salida_real,
        r.minutos_retardo, r.minutos_trabajados,
        r.estatus, r.incidencia,
      ].map(escape).join(','),
    ),
  ];
  return lines.join('\n');
}

export function descargarCsv(rows: AsistenciaRow[], filename = 'asistencia.csv') {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
