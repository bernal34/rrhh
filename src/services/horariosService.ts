import { supabase } from '@/lib/supabase';

export type Turno = {
  id: string;
  nombre: string;
  hora_entrada: string;
  hora_salida: string;
  tolerancia_retardo_min: number;
  tolerancia_falta_min: number;
  color: string | null;
  activo: boolean;
};

export type GrupoHorario = {
  id: string;
  nombre: string;
  descripcion: string | null;
  sucursal_id: string | null;
  activo: boolean;
};

export type GrupoTurnoDia = {
  grupo_id: string;
  dia_semana: number; // 0..6
  turno_id: string | null;
};

export type EmpleadoGrupo = {
  id: string;
  empleado_id: string;
  grupo_id: string;
  vigente_desde: string;
  vigente_hasta: string | null;
};

export async function listTurnos(onlyActive = true) {
  let q = supabase.from('turnos').select('*').order('nombre');
  if (onlyActive) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Turno[];
}

export async function upsertTurno(t: Partial<Turno>) {
  // cruza_medianoche es columna GENERATED en Postgres — no se puede escribir.
  // Whitelist de campos editables.
  const payload: Record<string, unknown> = {
    nombre: t.nombre,
    hora_entrada: t.hora_entrada,
    hora_salida: t.hora_salida,
    tolerancia_retardo_min: t.tolerancia_retardo_min,
    tolerancia_falta_min: t.tolerancia_falta_min,
    color: t.color,
    activo: t.activo ?? true,
  };
  if (t.id) payload.id = t.id;
  const { data, error } = await supabase.from('turnos').upsert(payload).select().single();
  if (error) throw error;
  return data as Turno;
}

export async function deleteTurno(id: string) {
  const { error } = await supabase.from('turnos').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

export async function listGrupos(onlyActive = true) {
  let q = supabase.from('grupos_horario').select('*').order('nombre');
  if (onlyActive) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as GrupoHorario[];
}

export async function upsertGrupo(g: Partial<GrupoHorario>) {
  const { data, error } = await supabase.from('grupos_horario').upsert(g).select().single();
  if (error) throw error;
  return data as GrupoHorario;
}

export async function deleteGrupo(id: string) {
  const { error } = await supabase.from('grupos_horario').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

export async function getGrupoTurnoDias(grupoId: string) {
  const { data, error } = await supabase
    .from('grupo_turno_dia')
    .select('*')
    .eq('grupo_id', grupoId);
  if (error) throw error;
  return data as GrupoTurnoDia[];
}

export async function setGrupoTurnoDia(grupoId: string, dia: number, turnoId: string | null) {
  const { error } = await supabase
    .from('grupo_turno_dia')
    .upsert({ grupo_id: grupoId, dia_semana: dia, turno_id: turnoId });
  if (error) throw error;
}

export async function asignarEmpleadoAGrupo(empleadoId: string, grupoId: string, desde?: string) {
  // Cierra asignación anterior
  await supabase
    .from('empleado_grupo')
    .update({ vigente_hasta: new Date().toISOString().slice(0, 10) })
    .eq('empleado_id', empleadoId)
    .is('vigente_hasta', null);

  const { error } = await supabase.from('empleado_grupo').insert({
    empleado_id: empleadoId,
    grupo_id: grupoId,
    vigente_desde: desde ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
}

export async function getGrupoActualDeEmpleado(empleadoId: string) {
  const { data } = await supabase
    .from('empleado_grupo')
    .select('*, grupo:grupos_horario(id, nombre)')
    .eq('empleado_id', empleadoId)
    .is('vigente_hasta', null)
    .maybeSingle();
  return data as (EmpleadoGrupo & { grupo: { id: string; nombre: string } | null }) | null;
}
