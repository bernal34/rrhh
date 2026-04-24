import { supabase } from '@/lib/supabase';

export type TipoActa =
  | 'amonestacion_verbal'
  | 'amonestacion_escrita'
  | 'acta_administrativa'
  | 'suspension'
  | 'rescision';

export type Acta = {
  id: string;
  folio: string;
  empleado_id: string;
  tipo: TipoActa;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  hechos: string;
  articulo_infringido: string | null;
  consecuencia: string | null;
  dias_suspension: number | null;
  testigos: Array<{ nombre: string; puesto?: string }>;
  firmada_por_empleado: boolean;
  negado_firmar: boolean;
  documento_path: string | null;
  notificada_at: string | null;
  created_at: string;
  cancelada_at: string | null;
  motivo_cancelacion: string | null;
  empleado?: { nombre: string; apellido_paterno: string | null; codigo: string | null };
};

export const tipoActaLabel: Record<TipoActa, string> = {
  amonestacion_verbal: 'Amonestación verbal',
  amonestacion_escrita: 'Amonestación escrita',
  acta_administrativa: 'Acta administrativa',
  suspension: 'Suspensión',
  rescision: 'Rescisión',
};

export async function listActas(filtros?: {
  empleadoId?: string;
  tipo?: TipoActa;
  desde?: string;
  hasta?: string;
}) {
  let q = supabase
    .from('actas_administrativas')
    .select('*, empleado:empleados(nombre, apellido_paterno, codigo)')
    .order('fecha', { ascending: false });

  if (filtros?.empleadoId) q = q.eq('empleado_id', filtros.empleadoId);
  if (filtros?.tipo) q = q.eq('tipo', filtros.tipo);
  if (filtros?.desde) q = q.gte('fecha', filtros.desde);
  if (filtros?.hasta) q = q.lte('fecha', filtros.hasta);

  const { data, error } = await q;
  if (error) throw error;
  return data as Acta[];
}

export async function upsertActa(a: Partial<Acta>) {
  const { data, error } = await supabase.from('actas_administrativas').upsert(a).select().single();
  if (error) throw error;
  return data as Acta;
}

export async function cancelarActa(id: string, motivo: string) {
  const { error } = await supabase
    .from('actas_administrativas')
    .update({
      cancelada_at: new Date().toISOString(),
      motivo_cancelacion: motivo,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function subirDocumentoActa(actaId: string, file: File) {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `actas/${actaId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('actas-incidencias').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/pdf',
  });
  if (error) throw error;
  await supabase
    .from('actas_administrativas')
    .update({ documento_path: path })
    .eq('id', actaId);
  return path;
}
