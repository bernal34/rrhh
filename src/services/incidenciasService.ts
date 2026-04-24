import { supabase } from '@/lib/supabase';

export type TipoIncidencia =
  | 'permiso_con_goce'
  | 'permiso_sin_goce'
  | 'vacaciones'
  | 'incapacidad_imss'
  | 'incapacidad_privada'
  | 'falta_justificada'
  | 'falta_injustificada'
  | 'retardo_justificado'
  | 'cambio_turno'
  | 'hora_extra'
  | 'descanso_laborado'
  | 'otro';

export type EstatusIncidencia = 'registrada' | 'aprobada' | 'rechazada' | 'aplicada';

export type Incidencia = {
  id: string;
  empleado_id: string;
  tipo: TipoIncidencia;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number | null;
  horas: number | null;
  afecta_sueldo: boolean;
  afecta_asistencia: boolean;
  monto_override: number | null;
  descripcion: string | null;
  folio_imss: string | null;
  documento_path: string | null;
  estatus: EstatusIncidencia;
  created_at: string;
  empleado?: { nombre: string; apellido_paterno: string | null; codigo: string | null };
};

export const tipoIncidenciaLabel: Record<TipoIncidencia, string> = {
  permiso_con_goce: 'Permiso con goce',
  permiso_sin_goce: 'Permiso sin goce',
  vacaciones: 'Vacaciones',
  incapacidad_imss: 'Incapacidad IMSS',
  incapacidad_privada: 'Incapacidad particular',
  falta_justificada: 'Falta justificada',
  falta_injustificada: 'Falta injustificada',
  retardo_justificado: 'Retardo justificado',
  cambio_turno: 'Cambio de turno',
  hora_extra: 'Hora extra',
  descanso_laborado: 'Descanso laborado',
  otro: 'Otro',
};

export async function listIncidencias(filtros?: {
  empleadoId?: string;
  desde?: string;
  hasta?: string;
  estatus?: EstatusIncidencia;
  tipo?: TipoIncidencia;
}) {
  let q = supabase
    .from('incidencias')
    .select('*, empleado:empleados(nombre, apellido_paterno, codigo)')
    .order('fecha_inicio', { ascending: false });

  if (filtros?.empleadoId) q = q.eq('empleado_id', filtros.empleadoId);
  if (filtros?.estatus) q = q.eq('estatus', filtros.estatus);
  if (filtros?.tipo) q = q.eq('tipo', filtros.tipo);
  if (filtros?.desde) q = q.gte('fecha_inicio', filtros.desde);
  if (filtros?.hasta) q = q.lte('fecha_fin', filtros.hasta);

  const { data, error } = await q;
  if (error) throw error;
  return data as Incidencia[];
}

export async function upsertIncidencia(i: Partial<Incidencia>) {
  const { data, error } = await supabase.from('incidencias').upsert(i).select().single();
  if (error) throw error;
  return data as Incidencia;
}

export async function aprobarIncidencia(id: string) {
  const { error } = await supabase
    .from('incidencias')
    .update({ estatus: 'aprobada', aprobada_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function rechazarIncidencia(id: string, motivo: string) {
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

export async function subirDocumento(path: string, file: File) {
  const { error } = await supabase.storage.from('actas-incidencias').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from('actas-incidencias')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
