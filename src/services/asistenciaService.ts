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

export type AsistenciaDiaEditable = {
  id: string;
  empleado_id: string;
  fecha: string;
  turno_id: string | null;
  hora_entrada_esperada: string | null;
  hora_salida_esperada: string | null;
  entrada_real: string | null;
  salida_real: string | null;
  minutos_retardo: number | null;
  minutos_trabajados: number | null;
  falta: boolean;
  incidencia: string | null;
  bloqueado: boolean;
  editado_manual: boolean;
  editado_motivo: string | null;
  editado_por: string | null;
  editado_at: string | null;
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

export type ResumenEmpleado = {
  empleado_id: string;
  empleado: string;
  codigo: string | null;
  sucursal: string | null;
  puesto: string | null;
  empresa_id: string | null;
  puesto_id: string | null;
  dias_con_turno: number;
  dias_trabajados: number;
  faltas: number;
  retardos: number;
  minutos_retardo_total: number;
  minutos_trabajados_total: number;
  pendientes: number;
  descansos: number;
  porcentaje_asistencia: number;
};

export async function getResumenAsistencia(
  desde: string,
  hasta: string,
  filtros?: { sucursal?: string; puestoId?: string; empresaId?: string },
): Promise<ResumenEmpleado[]> {
  const [rows, empMeta, puestosMeta] = await Promise.all([
    getAsistencia({ desde, hasta, sucursal: filtros?.sucursal }),
    supabase.from('empleados').select('id, empresa_id, puesto_id'),
    supabase.from('puestos').select('id, nombre'),
  ]);
  const empMap = new Map<string, { empresa_id: string | null; puesto_id: string | null }>();
  ((empMeta.data ?? []) as Array<{ id: string; empresa_id: string | null; puesto_id: string | null }>).forEach(
    (e) => empMap.set(e.id, { empresa_id: e.empresa_id, puesto_id: e.puesto_id }),
  );
  const puestoMap = new Map<string, string>();
  ((puestosMeta.data ?? []) as Array<{ id: string; nombre: string }>).forEach((p) =>
    puestoMap.set(p.id, p.nombre),
  );

  const acc = new Map<string, ResumenEmpleado>();
  for (const r of rows) {
    const meta = empMap.get(r.empleado_id) ?? { empresa_id: null, puesto_id: null };
    if (filtros?.empresaId && meta.empresa_id !== filtros.empresaId) continue;
    if (filtros?.puestoId && meta.puesto_id !== filtros.puestoId) continue;
    let cur = acc.get(r.empleado_id);
    if (!cur) {
      cur = {
        empleado_id: r.empleado_id,
        empleado: r.empleado,
        codigo: r.codigo,
        sucursal: r.sucursal,
        puesto: meta.puesto_id ? puestoMap.get(meta.puesto_id) ?? null : null,
        empresa_id: meta.empresa_id,
        puesto_id: meta.puesto_id,
        dias_con_turno: 0,
        dias_trabajados: 0,
        faltas: 0,
        retardos: 0,
        minutos_retardo_total: 0,
        minutos_trabajados_total: 0,
        pendientes: 0,
        descansos: 0,
        porcentaje_asistencia: 0,
      };
      acc.set(r.empleado_id, cur);
    }
    if (r.estatus === 'descanso') {
      cur.descansos += 1;
      continue;
    }
    cur.dias_con_turno += 1;
    if (r.estatus === 'falta') cur.faltas += 1;
    else if (r.estatus === 'retardo') cur.retardos += 1;
    else if (r.estatus === 'pendiente') cur.pendientes += 1;
    if (r.estatus === 'puntual' || r.estatus === 'retardo') cur.dias_trabajados += 1;
    cur.minutos_retardo_total += r.minutos_retardo ?? 0;
    cur.minutos_trabajados_total += r.minutos_trabajados ?? 0;
  }

  const list = Array.from(acc.values());
  list.forEach((e) => {
    e.porcentaje_asistencia =
      e.dias_con_turno > 0
        ? Math.round(((e.dias_con_turno - e.faltas) / e.dias_con_turno) * 1000) / 10
        : 0;
  });
  return list.sort((a, b) => a.empleado.localeCompare(b.empleado));
}

export async function listAsistenciaEmpleado(
  empleadoId: string,
  desde: string,
  hasta: string,
): Promise<AsistenciaDiaEditable[]> {
  const { data, error } = await supabase
    .from('asistencia_dia')
    .select(
      'id, empleado_id, fecha, turno_id, hora_entrada_esperada, hora_salida_esperada, entrada_real, salida_real, minutos_retardo, minutos_trabajados, falta, incidencia, bloqueado, editado_manual, editado_motivo, editado_por, editado_at',
    )
    .eq('empleado_id', empleadoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AsistenciaDiaEditable[];
}

export async function editarAsistenciaManual(args: {
  id: string;
  entrada: string | null;
  salida: string | null;
  falta: boolean;
  incidencia: string | null;
  motivo: string;
}) {
  const { data, error } = await supabase.rpc('fn_editar_asistencia_manual', {
    p_id: args.id,
    p_entrada: args.entrada,
    p_salida: args.salida,
    p_falta: args.falta,
    p_incidencia: args.incidencia,
    p_motivo: args.motivo,
  });
  if (error) throw error;
  return data as AsistenciaDiaEditable;
}

export async function verificarPasswordUsuario(password: string): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  const email = u.user?.email;
  if (!email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
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
