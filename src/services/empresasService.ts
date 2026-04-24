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
  activo: boolean;
};

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
    activo: e.activo ?? true,
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
