import { supabase } from '@/lib/supabase';

export type Capacitacion = {
  id: string;
  nombre: string;
  tema: string | null;
  tipo: string | null;
  fecha: string;
  duracion_horas: number;
  instructor: string | null;
  lugar: string | null;
  notas: string | null;
};

export type Asistente = {
  capacitacion_id: string;
  empleado_id: string;
  acreditado: boolean;
  calificacion: number | null;
  notas: string | null;
};

export async function listCapacitaciones() {
  const { data, error } = await supabase
    .from('capacitaciones')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Capacitacion[];
}

export async function upsertCapacitacion(c: Partial<Capacitacion>) {
  const payload: Record<string, unknown> = {
    nombre: c.nombre,
    tema: c.tema ?? null,
    tipo: c.tipo ?? null,
    fecha: c.fecha,
    duracion_horas: c.duracion_horas ?? 0,
    instructor: c.instructor ?? null,
    lugar: c.lugar ?? null,
    notas: c.notas ?? null,
  };
  if (c.id) payload.id = c.id;
  const { data, error } = await supabase
    .from('capacitaciones')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Capacitacion;
}

export async function listAsistentes(capacitacionId: string) {
  const { data, error } = await supabase
    .from('capacitacion_asistentes')
    .select('*, empleado:empleados(id, nombre, apellido_paterno, codigo, curp, rfc)')
    .eq('capacitacion_id', capacitacionId);
  if (error) throw error;
  return data ?? [];
}

export async function setAsistente(
  capacitacionId: string,
  empleadoId: string,
  acreditado: boolean,
) {
  const { error } = await supabase.from('capacitacion_asistentes').upsert({
    capacitacion_id: capacitacionId,
    empleado_id: empleadoId,
    acreditado,
  });
  if (error) throw error;
}

export async function quitarAsistente(capacitacionId: string, empleadoId: string) {
  const { error } = await supabase
    .from('capacitacion_asistentes')
    .delete()
    .eq('capacitacion_id', capacitacionId)
    .eq('empleado_id', empleadoId);
  if (error) throw error;
}
