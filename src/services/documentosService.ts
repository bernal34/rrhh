import { supabase } from '@/lib/supabase';

export type Documento = {
  id: string;
  empleado_id: string;
  tipo: string;
  nombre: string;
  storage_path: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  nota: string | null;
  created_at: string;
  empleado?: { nombre: string; apellido_paterno: string | null; codigo: string | null };
};

const BUCKET = 'empleados-docs';

export const tiposDocumento = [
  'Contrato',
  'INE',
  'CURP',
  'RFC',
  'Acta de nacimiento',
  'Comprobante de domicilio',
  'Examen médico',
  'Constancia de estudios',
  'Otro',
];

export async function listDocumentos(filtros?: {
  empleadoId?: string;
  porVencer?: boolean;
  tipo?: string;
}) {
  let q = supabase
    .from('documentos')
    .select('*, empleado:empleados(nombre, apellido_paterno, codigo)')
    .order('created_at', { ascending: false });

  if (filtros?.empleadoId) q = q.eq('empleado_id', filtros.empleadoId);
  if (filtros?.tipo) q = q.eq('tipo', filtros.tipo);
  if (filtros?.porVencer) {
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    q = q
      .not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', limite.toISOString().slice(0, 10));
  }

  const { data, error } = await q;
  if (error) throw error;
  return data as Documento[];
}

export async function subirDocumento(params: {
  empleado_id: string;
  tipo: string;
  nombre: string;
  file: File;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  nota?: string;
}) {
  const ext = params.file.name.split('.').pop() ?? 'bin';
  const safeTipo = params.tipo.replace(/\W+/g, '_').toLowerCase();
  const path = `${params.empleado_id}/${safeTipo}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    contentType: params.file.type || 'application/octet-stream',
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('documentos')
    .insert({
      empleado_id: params.empleado_id,
      tipo: params.tipo,
      nombre: params.nombre,
      storage_path: path,
      fecha_emision: params.fecha_emision ?? null,
      fecha_vencimiento: params.fecha_vencimiento ?? null,
      nota: params.nota ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Documento;
}

export async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarDocumento(id: string, path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase.from('documentos').delete().eq('id', id);
  if (error) throw error;
}
