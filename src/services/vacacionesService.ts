import { supabase } from '@/lib/supabase';

export type VacacionSaldo = {
  empleado_id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  codigo: string | null;
  sucursal_id: string | null;
  fecha_ingreso: string;
  anios_antiguedad: number;
  dias_ganados_total: number;
  dias_tomados: number;
  dias_tomados_anio_actual: number;
  dias_proximo_periodo: number;
  fecha_proximo_aniversario: string;
};

export type VacacionSolicitud = {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_codigo: string | null;
  sucursal_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  descripcion: string | null;
  estatus: 'registrada' | 'aprobada' | 'rechazada' | 'aplicada';
  created_at: string;
  aprobada_at: string | null;
  motivo_rechazo: string | null;
};

export async function listSaldos(filtros: { sucursal_id?: string; q?: string } = {}) {
  let q = supabase.from('vacaciones_saldos').select('*').order('apellido_paterno', { nullsFirst: false });
  if (filtros.sucursal_id) q = q.eq('sucursal_id', filtros.sucursal_id);
  const { data, error } = await q;
  if (error) throw error;
  let list = (data ?? []) as VacacionSaldo[];
  if (filtros.q) {
    const t = filtros.q.toLowerCase();
    list = list.filter(
      (s) =>
        s.nombre.toLowerCase().includes(t) ||
        s.apellido_paterno?.toLowerCase().includes(t) ||
        s.codigo?.toLowerCase().includes(t),
    );
  }
  return list;
}

export async function listSolicitudes(filtros: { estatus?: string } = {}) {
  let q = supabase
    .from('vacaciones_solicitudes')
    .select('*')
    .order('fecha_inicio', { ascending: false });
  if (filtros.estatus) q = q.eq('estatus', filtros.estatus);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as VacacionSolicitud[];
}

export async function solicitarVacaciones(args: {
  empleado_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
}) {
  const { error } = await supabase.from('incidencias').insert({
    empleado_id: args.empleado_id,
    tipo: 'vacaciones',
    fecha_inicio: args.fecha_inicio,
    fecha_fin: args.fecha_fin,
    afecta_sueldo: false,
    afecta_asistencia: false,
    descripcion: args.descripcion ?? null,
    estatus: 'registrada',
  });
  if (error) throw error;
}

export async function aprobarSolicitud(id: string) {
  const { error } = await supabase
    .from('incidencias')
    .update({ estatus: 'aprobada', aprobada_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function rechazarSolicitud(id: string, motivo: string) {
  const { error } = await supabase
    .from('incidencias')
    .update({
      estatus: 'rechazada',
      rechazada_at: new Date().toISOString(),
      motivo_rechazo: motivo,
    })
    .eq('id', id);
  if (error) throw error;
}
