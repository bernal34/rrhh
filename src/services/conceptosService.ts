import { supabase } from '@/lib/supabase';

export type ConceptoNomina = {
  id: string;
  clave: string;
  nombre: string;
  tipo: 'percepcion' | 'deduccion';
  calculo: 'fijo' | 'porcentaje' | 'formula' | 'automatico';
  valor: number | null;
  formula: string | null;
  grava_isr: boolean;
  grava_imss: boolean;
  activo: boolean;
  orden: number;
};

export async function listConceptos(onlyActive = true) {
  let q = supabase.from('conceptos_nomina').select('*').order('orden');
  if (onlyActive) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as ConceptoNomina[];
}

export async function upsertConcepto(c: Partial<ConceptoNomina>) {
  const { data, error } = await supabase.from('conceptos_nomina').upsert(c).select().single();
  if (error) throw error;
  return data as ConceptoNomina;
}

export async function toggleConcepto(id: string, activo: boolean) {
  const { error } = await supabase.from('conceptos_nomina').update({ activo }).eq('id', id);
  if (error) throw error;
}
