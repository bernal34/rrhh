import { supabase } from '@/lib/supabase';

export type Sucursal = {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
};

export type Puesto = {
  id: string;
  nombre: string;
  sueldo_base_sugerido: number | null;
  activo: boolean;
};

export async function listSucursales(soloActivos = true) {
  let q = supabase
    .from('sucursales')
    .select('id, nombre, direccion, telefono, activo')
    .order('nombre');
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Sucursal[];
}

export async function upsertSucursal(s: Partial<Sucursal>) {
  const payload: Record<string, unknown> = {
    nombre: s.nombre,
    direccion: s.direccion ?? null,
    telefono: s.telefono ?? null,
    activo: s.activo ?? true,
  };
  if (s.id) payload.id = s.id;
  const { error } = await supabase.from('sucursales').upsert(payload);
  if (error) throw error;
}

export async function deleteSucursal(id: string) {
  const { error } = await supabase
    .from('sucursales')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}

export async function reactivarSucursal(id: string) {
  const { error } = await supabase
    .from('sucursales')
    .update({ activo: true })
    .eq('id', id);
  if (error) throw error;
}

export async function listPuestos() {
  const { data, error } = await supabase
    .from('puestos')
    .select('id, nombre, sueldo_base_sugerido, activo')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data as Puesto[];
}
