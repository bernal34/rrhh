import { supabase } from '@/lib/supabase';

export type Empresa = {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  rfc: string | null;
  regimen_fiscal: string | null;
  domicilio_fiscal: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
  telefono: string | null;
  email: string | null;
  registro_patronal_imss: string | null;
  representante_legal: string | null;
  representante_puesto: string | null;
  notas: string | null;
  logo_url: string | null;
  principal: boolean;
  activo: boolean;
};

export async function marcarPrincipal(id: string) {
  // Quita principal de las demás primero (para no romper el unique parcial)
  const { error: e1 } = await supabase
    .from('empresas')
    .update({ principal: false })
    .neq('id', id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('empresas')
    .update({ principal: true })
    .eq('id', id);
  if (e2) throw e2;
}

export async function uploadLogo(empresaId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${empresaId}/logo.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('empresas-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('empresas-logos').getPublicUrl(path);
  // bust cache para que el nuevo logo se vea de inmediato
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function listEmpresas(soloActivas = true) {
  let q = supabase.from('empresas').select('*').order('razon_social');
  if (soloActivas) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Empresa[];
}

export async function getEmpresa(id: string) {
  const { data, error } = await supabase.from('empresas').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Empresa;
}

export async function upsertEmpresa(e: Partial<Empresa>) {
  const payload: Record<string, unknown> = {
    razon_social: e.razon_social,
    nombre_comercial: e.nombre_comercial ?? null,
    rfc: e.rfc ?? null,
    regimen_fiscal: e.regimen_fiscal ?? null,
    domicilio_fiscal: e.domicilio_fiscal ?? null,
    ciudad: e.ciudad ?? null,
    estado: e.estado ?? null,
    cp: e.cp ?? null,
    telefono: e.telefono ?? null,
    email: e.email ?? null,
    registro_patronal_imss: e.registro_patronal_imss ?? null,
    representante_legal: e.representante_legal ?? null,
    representante_puesto: e.representante_puesto ?? null,
    notas: e.notas ?? null,
    logo_url: e.logo_url ?? null,
    activo: e.activo ?? true,
    // principal se gestiona aparte vía marcarPrincipal() para respetar el unique
  };
  if (e.id) payload.id = e.id;
  const { error } = await supabase.from('empresas').upsert(payload);
  if (error) throw error;
}

export async function deleteEmpresa(id: string) {
  const { error } = await supabase.from('empresas').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

export async function reactivarEmpresa(id: string) {
  const { error } = await supabase.from('empresas').update({ activo: true }).eq('id', id);
  if (error) throw error;
}
