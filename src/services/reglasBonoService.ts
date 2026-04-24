import { supabase } from '@/lib/supabase';

export type ReglaBono = {
  id: string;
  concepto_id: string;
  nombre: string;
  tipo: 'puntualidad' | 'asistencia' | 'fijo';
  monto: number;
  max_retardos_permitidos: number | null;
  max_faltas_permitidas: number | null;
  aplica_sucursal_id: string | null;
  activo: boolean;
  concepto?: { nombre: string; clave: string };
};

export async function listReglasBono(onlyActive = true) {
  let q = supabase
    .from('reglas_bono')
    .select('*, concepto:conceptos_nomina(nombre, clave)')
    .order('nombre');
  if (onlyActive) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as ReglaBono[];
}

export async function upsertReglaBono(r: Partial<ReglaBono>) {
  const payload = { ...r };
  delete (payload as { concepto?: unknown }).concepto;
  const { data, error } = await supabase.from('reglas_bono').upsert(payload).select().single();
  if (error) throw error;
  return data as ReglaBono;
}

export async function toggleReglaBono(id: string, activo: boolean) {
  const { error } = await supabase.from('reglas_bono').update({ activo }).eq('id', id);
  if (error) throw error;
}
