import { supabase } from '@/lib/supabase';

const FOTOS_BUCKET = 'empleados-fotos';
const DOCS_BUCKET = 'empleados-docs';

export async function uploadFotoEmpleado(empleadoId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${empleadoId}/foto-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadDocumento(
  empleadoId: string,
  file: File,
  tipo: string,
): Promise<string> {
  const safeTipo = tipo.replace(/\W+/g, '_').toLowerCase();
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${empleadoId}/${safeTipo}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  return path;
}

export async function signedUrlDocumento(path: string, expiresInSec = 60 * 60) {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
