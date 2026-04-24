import { supabase } from '@/lib/supabase';

export type Periodo = {
  id: string;
  tipo: 'semanal' | 'quincenal' | 'mensual';
  fecha_inicio: string;
  fecha_fin: string;
  fecha_pago: string | null;
  estatus: 'abierto' | 'calculado' | 'pagado' | 'cancelado';
  sucursal_id: string | null;
};

export type Prenomina = {
  id: string;
  periodo_id: string;
  sucursal_id: string | null;
  estatus: 'borrador' | 'en_revision' | 'autorizada' | 'cancelada' | 'convertida';
  total_percepciones: number;
  total_deducciones: number;
  total_neto: number;
  num_empleados: number;
  nota: string | null;
  created_at: string;
  autorizada_at: string | null;
  cancelada_at: string | null;
  motivo_cancelacion: string | null;
  periodo?: Periodo;
};

export type PrenominaDetalle = {
  id: string;
  empleado_id: string;
  dias_trabajados: number;
  faltas: number;
  retardos: number;
  total_percepciones: number;
  total_deducciones: number;
  neto_pagar: number;
  desglose: Record<string, unknown> | null;
  empleado?: { nombre: string; apellido_paterno: string | null; codigo: string | null };
};

export async function listPeriodos() {
  const { data, error } = await supabase
    .from('periodos_nomina')
    .select('*')
    .order('fecha_inicio', { ascending: false });
  if (error) throw error;
  return data as Periodo[];
}

export async function crearPeriodo(p: Partial<Periodo>) {
  const { data, error } = await supabase.from('periodos_nomina').insert(p).select().single();
  if (error) throw error;
  return data as Periodo;
}

export async function listPrenominas() {
  const { data, error } = await supabase
    .from('prenomina')
    .select('*, periodo:periodos_nomina(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Prenomina[];
}

export async function generarPrenomina(periodoId: string, sucursalId?: string) {
  const { data, error } = await supabase.rpc('fn_generar_prenomina', {
    p_periodo_id: periodoId,
    p_sucursal_id: sucursalId ?? null,
  });
  if (error) throw error;
  return data as string; // uuid de prenomina
}

export async function enviarARevision(prenominaId: string) {
  const { error } = await supabase
    .from('prenomina')
    .update({
      estatus: 'en_revision',
      enviada_revision_at: new Date().toISOString(),
    })
    .eq('id', prenominaId);
  if (error) throw error;
}

export async function autorizarPrenomina(prenominaId: string) {
  const { error } = await supabase.rpc('fn_autorizar_prenomina', { p_pre_id: prenominaId });
  if (error) throw error;
}

export async function cancelarPrenomina(prenominaId: string, motivo: string) {
  const { error } = await supabase.rpc('fn_cancelar_prenomina', {
    p_pre_id: prenominaId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function getPrenominaDetalle(prenominaId: string) {
  const { data, error } = await supabase
    .from('nomina_detalle')
    .select('*, empleado:empleados(nombre, apellido_paterno, codigo)')
    .eq('prenomina_id', prenominaId)
    .order('neto_pagar', { ascending: false });
  if (error) throw error;
  return data as PrenominaDetalle[];
}
